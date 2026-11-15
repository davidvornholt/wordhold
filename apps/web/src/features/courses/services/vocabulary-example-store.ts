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

const insertGenerated = (
  sql: Database,
  entryId: string,
  example: Omit<VocabularyExample, 'source'>,
) =>
  sql<VocabularyExample>`
    insert into entry_examples (
      entry_id, target_text, native_text, source, position
    )
    values (
      ${entryId}, ${example.targetText}, ${example.nativeText}, 'generated', 0
    )
    returning target_text as "targetText",
      native_text as "nativeText", source
  `.pipe(Effect.map((rows) => rows[0] ?? ('entry-missing' as const)));

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
            yield* sql`select 1 from entries where id = ${entryId} for share`;
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

      const storeAudio = (
        entryId: string,
        exampleTargetText: string,
        audioProfile: string,
        audioPath: string,
      ) =>
        sql<{ readonly stored: boolean }>`
          update entry_examples
          set audio_profile = ${audioProfile}, audio_path = ${audioPath}
          where id = (
            select id from entry_examples
            where entry_id = ${entryId}
            order by position, id
            limit 1
          )
            and target_text = ${exampleTargetText}
          returning true as stored
        `.pipe(
          Effect.map((rows) => rows[0]?.stored === true),
          Effect.mapError((cause) =>
            databaseError('store example audio', cause),
          ),
        );

      const storeTranslation = (
        entryId: string,
        exampleTargetText: string,
        nativeText: string,
      ) =>
        sql<{ readonly stored: boolean }>`
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
        `.pipe(
          Effect.map((rows) => rows[0]?.stored === true),
          Effect.mapError((cause) =>
            databaseError('store example translation', cause),
          ),
        );

      return {
        read,
        storeGenerated,
        storeAudio,
        storeTranslation,
        withCriticalSection,
      } as const;
    }),
  );
}
