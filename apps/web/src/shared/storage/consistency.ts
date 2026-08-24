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
  /^pages\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/u;
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

type PersistFileReferenceInput<T> = {
  readonly write: () => Promise<void>;
  readonly persistReference: () => Promise<T>;
  readonly remove: () => Promise<void>;
};

export const persistFileReference = async <T>(
  input: PersistFileReferenceInput<T>,
): Promise<T> => {
  await input.write();
  try {
    return await input.persistReference();
  } catch (persistenceError) {
    try {
      await input.remove();
    } catch (cleanupError) {
      throw Object.assign(
        new Error('The database write and file cleanup both failed.', {
          cause: cleanupError,
        }),
        { persistenceError },
      );
    }
    throw persistenceError;
  }
};
