import { Database } from '@wordhold/db/client';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Context, Effect, Layer } from 'effect';
import { CourseDatabaseError } from '../errors/courses-errors';
import type { VocabularyExample } from '../schemas/course-units';

export type VocabularyExampleContext = {
  readonly entryId: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly targetLanguage: LanguageCode;
  readonly example: VocabularyExample | null;
  readonly exampleAudioProfile: string | null;
  readonly exampleAudioPath: string | null;
};

// The word an example was generated for.
export type GeneratedFor = Pick<
  VocabularyExampleContext,
  'entryId' | 'targetText' | 'nativeText'
>;

type VocabularyExampleRow = {
  readonly entryId: string;
  readonly targetText: string;
  readonly nativeText: string;
  readonly targetLanguage: LanguageCode;
  readonly exampleTargetText: string | null;
  readonly exampleNativeText: string | null;
  readonly exampleSource: VocabularyExample['source'] | null;
  readonly exampleAudioProfile: string | null;
  readonly exampleAudioPath: string | null;
};

const databaseError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Der Beispielsatz konnte nicht gespeichert werden.',
  });

// A vocabulary editor shows the example, so an example written after it was
// opened makes it outdated: its save would remove or overwrite the example.
// Callers hold the entry's row lock, which an edit takes before it compares
// revisions.
const markExampleWritten = (sql: Database, entryId: string) =>
  sql`update entries set revision = revision + 1 where id = ${entryId}`;

const lockEntry = (sql: Database, entryId: string) =>
  sql`select 1 from entries where id = ${entryId} for no key update`;

const insertGenerated = (
  sql: Database,
  entryId: string,
  example: Omit<VocabularyExample, 'source'>,
) =>
  Effect.gen(function* () {
    const rows = yield* sql<VocabularyExample>`
      insert into entry_examples (
        entry_id, target_text, native_text, source, position
      )
      values (
        ${entryId}, ${example.targetText}, ${example.nativeText}, 'generated', 0
      )
      returning target_text as "targetText",
        native_text as "nativeText", source
    `;
    yield* markExampleWritten(sql, entryId);
    return rows[0] ?? ('entry-missing' as const);
  });

// The entry's row is locked first, as an edit locks it before it reads
// the example. The revision rises only when the write changes what is
// stored, so repeating it does not outdate another open editor.
type ExampleAudio = {
  readonly exampleTargetText: string;
  readonly audioProfile: string;
  readonly audioPath: string;
};

const storeAudio = (
  sql: Database,
  entryId: string,
  { exampleTargetText, audioProfile, audioPath }: ExampleAudio,
) =>
  sql
    .withTransaction(
      Effect.gen(function* () {
        yield* lockEntry(sql, entryId);
        const rows = yield* sql<{ readonly changed: boolean }>`
          update entry_examples x
          set audio_profile = ${audioProfile}, audio_path = ${audioPath}
          from (
            select id, audio_profile, audio_path from entry_examples
            where entry_id = ${entryId}
            order by position, id
            limit 1
          ) first
          where x.id = first.id and x.target_text = ${exampleTargetText}
          returning (
            first.audio_profile is distinct from ${audioProfile}
            or first.audio_path is distinct from ${audioPath}
          ) as changed
        `;
        if (rows[0]?.changed === true) {
          yield* markExampleWritten(sql, entryId);
        }
        return rows[0] !== undefined;
      }),
    )
    .pipe(
      Effect.mapError((cause) => databaseError('store example audio', cause)),
    );

const storeTranslation = (
  sql: Database,
  entryId: string,
  exampleTargetText: string,
  nativeText: string,
) =>
  sql
    .withTransaction(
      Effect.gen(function* () {
        yield* lockEntry(sql, entryId);
        const rows = yield* sql<{ readonly stored: boolean }>`
          update entry_examples
          set native_text = ${nativeText}
          where id = (
            select id from entry_examples
            where entry_id = ${entryId}
            order by position, id
            limit 1
          )
            and target_text = ${exampleTargetText}
            and native_text is null
          returning true as stored
        `;
        if (rows[0] === undefined) {
          return false;
        }
        yield* markExampleWritten(sql, entryId);
        return true;
      }),
    )
    .pipe(
      Effect.mapError((cause) =>
        databaseError('store example translation', cause),
      ),
    );

export class VocabularyExampleStore extends Context.Service<
  VocabularyExampleStore,
  {
    readonly read: (
      entryId: string,
    ) => Effect.Effect<
      VocabularyExampleContext | undefined,
      CourseDatabaseError
    >;
    // Resolves to the entry's example, or to why the one generated for the
    // word was not stored. Generation takes long enough for the word to be
    // corrected meanwhile, and a sentence for the old word must not land on
    // the new one. The entry's row lock, held until the transaction ends,
    // orders this check with an edit, which locks the row before it reads
    // the stored example.
    readonly storeGenerated: (
      word: GeneratedFor,
      example: Omit<VocabularyExample, 'source'>,
    ) => Effect.Effect<
      VocabularyExample | 'entry-missing' | 'word-changed',
      CourseDatabaseError
    >;
    readonly storeAudio: (
      entryId: string,
      exampleTargetText: string,
      audioProfile: string,
      audioPath: string,
    ) => Effect.Effect<boolean, CourseDatabaseError>;
    readonly storeTranslation: (
      entryId: string,
      exampleTargetText: string,
      nativeText: string,
    ) => Effect.Effect<boolean, CourseDatabaseError>;
    readonly withCriticalSection: <A, E, R>(
      entryId: string,
      effect: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E | CourseDatabaseError, R>;
  }
>()('wordhold/VocabularyExampleStore') {
  static readonly live = Layer.effect(
    VocabularyExampleStore,
    Effect.gen(function* () {
      const sql = yield* Database;

      const mapRow = (row: VocabularyExampleRow): VocabularyExampleContext => ({
        entryId: row.entryId,
        targetText: row.targetText,
        nativeText: row.nativeText,
        targetLanguage: row.targetLanguage,
        example:
          row.exampleTargetText === null || row.exampleSource === null
            ? null
            : {
                targetText: row.exampleTargetText,
                nativeText: row.exampleNativeText,
                source: row.exampleSource,
              },
        exampleAudioProfile: row.exampleAudioProfile,
        exampleAudioPath: row.exampleAudioPath,
      });

      // A subject's term has no example sentence, so it reads as missing.
      const selectContext = (entryId: string) => sql<VocabularyExampleRow>`
        select e.id as "entryId", e.target_text as "targetText",
          e.native_text as "nativeText",
          co.target_language as "targetLanguage",
          example.target_text as "exampleTargetText",
          example.native_text as "exampleNativeText",
          example.source as "exampleSource",
          example.audio_profile as "exampleAudioProfile",
          example.audio_path as "exampleAudioPath"
        from entries e
        join courses co on co.id = e.course_id
        left join lateral (
          select target_text, native_text, source, audio_profile, audio_path
          from entry_examples
          where entry_id = e.id
          order by position, id
          limit 1
        ) example on true
        where e.id = ${entryId} and co.kind = 'language'
      `;

      const read = (entryId: string) =>
        selectContext(entryId).pipe(
          Effect.map(([row]) => (row === undefined ? undefined : mapRow(row))),
          Effect.mapError((cause) => databaseError('read example', cause)),
        );

      const withCriticalSection = <A, E, R>(
        entryId: string,
        effect: Effect.Effect<A, E, R>,
      ) =>
        sql
          .withTransaction(
            Effect.andThen(
              sql`select pg_advisory_xact_lock(hashtextextended(${`wordhold:entry-example:${entryId}`}, 0))`,
              effect,
            ),
          )
          .pipe(
            Effect.catchTag('SqlError', (cause) =>
              Effect.fail(
                databaseError('coordinate example preparation', cause),
              ),
            ),
          );

      const storeGenerated = (
        { entryId, targetText, nativeText }: GeneratedFor,
        example: Omit<VocabularyExample, 'source'>,
      ) =>
        withCriticalSection(
          entryId,
          Effect.gen(function* () {
            yield* lockEntry(sql, entryId);
            const context = yield* read(entryId);
            if (context === undefined) {
              return 'entry-missing' as const;
            }
            if (context.example !== null) {
              return context.example;
            }
            if (
              context.targetText !== targetText ||
              context.nativeText !== nativeText
            ) {
              return 'word-changed' as const;
            }
            return yield* insertGenerated(sql, entryId, example);
          }),
        ).pipe(
          Effect.mapError((cause) =>
            databaseError('store generated example', cause),
          ),
        );

      return {
        read,
        storeGenerated,
        storeAudio: (
          entryId: string,
          exampleTargetText: string,
          audioProfile: string,
          audioPath: string,
        ) =>
          storeAudio(sql, entryId, {
            exampleTargetText,
            audioProfile,
            audioPath,
          }),
        storeTranslation: (
          entryId: string,
          exampleTargetText: string,
          nativeText: string,
        ) => storeTranslation(sql, entryId, exampleTargetText, nativeText),
        withCriticalSection,
      } as const;
    }),
  );
}
