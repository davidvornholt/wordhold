import { Effect } from 'effect';
import { FileReferenceError } from './file-reference-error';

const hoursPerDay = 24;
const minutesPerHour = 60;
const secondsPerMinute = 60;
const millisecondsPerSecond = 1000;

export const orphanGracePeriodMs =
  hoursPerDay * minutesPerHour * secondsPerMinute * millisecondsPerSecond;

export type StoredDataFile = {
  readonly relativePath: string;
  readonly modifiedAtMs: number;
};

const generatedPagePath =
  /^pages\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?\.(?:jpg|png|webp)$/u;
const generatedAudioPath =
  /^audio\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[a-z0-9_-]+\.mp3$/u;

export const orphanedDataFiles = (
  files: ReadonlyArray<StoredDataFile>,
  referencedPaths: ReadonlySet<string>,
  nowMs: number,
): ReadonlyArray<string> =>
  files
    .filter(
      (file) =>
        (generatedPagePath.test(file.relativePath) ||
          generatedAudioPath.test(file.relativePath)) &&
        !referencedPaths.has(file.relativePath) &&
        nowMs - file.modifiedAtMs >= orphanGracePeriodMs,
    )
    .map((file) => file.relativePath)
    .sort();

type PersistFileReferenceInput<T, WriteError, PersistenceError, RemoveError> = {
  readonly write: Effect.Effect<void, WriteError>;
  readonly persistReference: Effect.Effect<T, PersistenceError>;
  readonly remove: Effect.Effect<void, RemoveError>;
};

export const persistFileReference = <
  T,
  WriteError,
  PersistenceError,
  RemoveError,
>(
  input: PersistFileReferenceInput<
    T,
    WriteError,
    PersistenceError,
    RemoveError
  >,
): Effect.Effect<T, WriteError | PersistenceError | FileReferenceError> =>
  input.write.pipe(
    Effect.flatMap(() =>
      input.persistReference.pipe(
        Effect.catchAll((persistenceError) =>
          input.remove.pipe(
            Effect.catchAll((cleanupError) =>
              Effect.fail(
                new FileReferenceError({
                  persistenceError,
                  cleanupError,
                  message: 'The database write and file cleanup both failed.',
                }),
              ),
            ),
            Effect.zipRight(Effect.fail(persistenceError)),
          ),
        ),
      ),
    ),
  );
