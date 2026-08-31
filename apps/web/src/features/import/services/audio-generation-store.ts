import { ttsAudioProfile } from '@wordhold/ai/tts/speech-text';
import { Database } from '@wordhold/db/client';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import { Context, Effect, Layer } from 'effect';
import { ImportDatabaseError } from '../errors/import-database-error';
import type { InsertedEntry } from './repository';

export type AudioTarget = InsertedEntry & {
  readonly language: LanguageCode;
};

export type AudioGenerationStoreShape = {
  readonly listMissingForPage: (
    pageId: string,
  ) => Effect.Effect<ReadonlyArray<AudioTarget>, ImportDatabaseError>;
  readonly hasReference: (
    entryId: string,
    audioProfile: string,
  ) => Effect.Effect<boolean, ImportDatabaseError>;
  readonly upsertReference: (
    entryId: string,
    voice: string,
    path: string,
  ) => Effect.Effect<void, ImportDatabaseError>;
  readonly withCriticalSection: <A, E, R>(
    entryId: string,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | ImportDatabaseError, R>;
};

export class AudioGenerationStore extends Context.Tag(
  '@wordhold/web/import/AudioGenerationStore',
)<AudioGenerationStore, AudioGenerationStoreShape>() {}

const databaseFailure = (operation: string, cause: unknown) =>
  new ImportDatabaseError({
    operation,
    cause,
    message: `Database operation failed: ${operation}.`,
  });

export const AudioGenerationStoreLive = Layer.effect(
  AudioGenerationStore,
  Effect.gen(function* () {
    const sql = yield* Database;
    const hasReference = (entryId: string, audioProfile: string) =>
      sql<{ present: boolean }>`
        select exists(
          select 1 from entry_audio
          where entry_id = ${entryId} and voice = ${audioProfile}
        ) as present
      `.pipe(
        Effect.map((rows) => rows[0]?.present === true),
        Effect.mapError((cause) =>
          databaseFailure('check audio reference', cause),
        ),
      );
    return AudioGenerationStore.of({
      listMissingForPage: (pageId) =>
        sql<AudioTarget & { readonly audioProfiles: ReadonlyArray<string> }>`
          select e.id, e.target_text as "targetText",
            c.target_language as language,
            coalesce(
              array_agg(a.voice) filter (where a.voice is not null),
              array[]::text[]
            ) as "audioProfiles"
          from entries e
          join courses c on c.id = e.course_id
          left join entry_audio a on a.entry_id = e.id
          where e.page_id = ${pageId}
          group by e.id, c.target_language
          order by e.created_at, e.id
        `.pipe(
          Effect.map((rows) =>
            rows
              .filter(
                (row) =>
                  !row.audioProfiles.includes(
                    ttsAudioProfile(row.targetText, row.language),
                  ),
              )
              .map(({ audioProfiles: _, ...target }) => target),
          ),
          Effect.mapError((cause) =>
            databaseFailure('list entries missing audio', cause),
          ),
        ),
      hasReference,
      upsertReference: (entryId, voice, path) =>
        sql`delete from entry_audio where entry_id = ${entryId}`.pipe(
          Effect.zipRight(sql`
            insert into entry_audio (entry_id, voice, path)
            values (${entryId}, ${voice}, ${path})
          `),
          Effect.asVoid,
          Effect.mapError((cause) =>
            databaseFailure('upsert audio reference', cause),
          ),
        ),
      withCriticalSection: <A, E, R>(
        entryId: string,
        effect: Effect.Effect<A, E, R>,
      ) =>
        sql
          .withTransaction(
            Effect.zipRight(
              sql`select pg_advisory_xact_lock(hashtextextended(${`wordhold:entry-audio:${entryId}`}, 0))`,
              effect,
            ),
          )
          .pipe(
            Effect.catchTag('SqlError', (cause) =>
              Effect.fail(
                databaseFailure('coordinate audio generation', cause),
              ),
            ),
          ),
    });
  }),
);
