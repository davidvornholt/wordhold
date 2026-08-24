import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { ImportDatabaseError } from '../errors/import-database-error';

const failure = (operation: string, cause: unknown) =>
  new ImportDatabaseError({
    operation,
    cause,
    message: `Database operation failed: ${operation}.`,
  });

export const storageRepositoryLive = (sql: Database) => ({
  referencedPaths: Effect.all([
    sql<{ path: string }>`select image_path as path from pages`,
    sql<{ path: string }>`select path from entry_audio`,
  ]).pipe(
    Effect.map(
      ([pageReferences, audioReferences]) =>
        new Set([
          ...pageReferences.map((reference) => reference.path),
          ...audioReferences.map((reference) => reference.path),
        ]),
    ),
    Effect.mapError((cause) => failure('list stored file references', cause)),
  ),
  upsertAudioReference: (entryId: string, voice: string, path: string) =>
    sql`insert into entry_audio (entry_id, voice, path) values (${entryId}, ${voice}, ${path}) on conflict (entry_id, voice) do update set path = excluded.path`.pipe(
      Effect.asVoid,
      Effect.mapError((cause) => failure('upsert audio reference', cause)),
    ),
});
