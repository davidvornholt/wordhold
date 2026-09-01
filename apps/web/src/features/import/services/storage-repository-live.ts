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
    sql<{ path: string }>`
      select audio_path as path
      from entry_examples
      where audio_path is not null
    `,
  ]).pipe(
    Effect.map(
      ([pageReferences, audioReferences, exampleAudioReferences]) =>
        new Set([
          ...pageReferences.map((reference) => reference.path),
          ...audioReferences.map((reference) => reference.path),
          ...exampleAudioReferences.map((reference) => reference.path),
        ]),
    ),
    Effect.mapError((cause) => failure('list stored file references', cause)),
  ),
});
