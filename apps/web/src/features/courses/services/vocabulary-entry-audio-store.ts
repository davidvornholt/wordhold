import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { entryAudioLockKey } from '../../../shared/audio/speech-audio';
import { CourseDatabaseError } from '../errors/courses-errors';

const databaseError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Die Vokabel konnte nicht gespeichert werden.',
  });

export const makeEntryAudioStore = (sql: Database) => {
  const storeAudio = (
    entryId: string,
    audioProfile: string,
    audioPath: string,
  ) =>
    sql`
      insert into entry_audio (entry_id, voice, path)
      values (${entryId}, ${audioProfile}, ${audioPath})
      on conflict (entry_id, voice) do update set path = excluded.path
    `.pipe(
      Effect.asVoid,
      Effect.mapError((cause) => databaseError('store entry audio', cause)),
    );

  const hasAudio = (entryId: string, audioProfile: string) =>
    sql<{ present: boolean }>`
      select exists(
        select 1 from entry_audio
        where entry_id = ${entryId} and voice = ${audioProfile}
      ) as present
    `.pipe(
      Effect.map((rows) => rows[0]?.present === true),
      Effect.mapError((cause) => databaseError('check entry audio', cause)),
    );

  const withAudioLock = <A, E, R>(
    entryId: string,
    effect: Effect.Effect<A, E, R>,
  ) =>
    sql
      .withTransaction(
        Effect.andThen(
          sql`select pg_advisory_xact_lock(hashtextextended(${entryAudioLockKey(entryId)}, 0))`,
          effect,
        ),
      )
      .pipe(
        Effect.catchTag('SqlError', (cause) =>
          Effect.fail(databaseError('coordinate entry audio', cause)),
        ),
      );

  return { storeAudio, hasAudio, withAudioLock } as const;
};
