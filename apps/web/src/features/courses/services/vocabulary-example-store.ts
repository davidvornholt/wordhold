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

export class VocabularyExampleStore extends Context.Tag(
  'wordhold/VocabularyExampleStore',
)<
  VocabularyExampleStore,
  {
    readonly read: (
      entryId: string,
    ) => Effect.Effect<
      VocabularyExampleContext | undefined,
      CourseDatabaseError
    >;
    readonly storeGenerated: (
      entryId: string,
      example: Omit<VocabularyExample, 'source'>,
    ) => Effect.Effect<VocabularyExample | undefined, CourseDatabaseError>;
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
>() {
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
        where e.id = ${entryId}
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
            Effect.zipRight(
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
        entryId: string,
        example: Omit<VocabularyExample, 'source'>,
      ) =>
        withCriticalSection(
          entryId,
          Effect.gen(function* () {
            const context = yield* read(entryId);
            if (context === undefined) {
              return;
            }
            if (context.example !== null) {
              return context.example;
            }
            const inserted = yield* sql<VocabularyExample>`
                insert into entry_examples (
                  entry_id, target_text, native_text, source, position
                )
                values (
                  ${entryId}, ${example.targetText}, ${example.nativeText}, 'generated', 0
                )
                returning target_text as "targetText",
                  native_text as "nativeText", source
              `;
            return inserted[0];
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
