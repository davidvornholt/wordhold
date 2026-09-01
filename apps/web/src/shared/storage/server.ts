// The designated filesystem boundary: the only application module allowed to
// use Node APIs. Database rows store paths relative to WORDHOLD_DATA_DIR.
import { Buffer } from 'node:buffer';
import type { Dirent } from 'node:fs';
import {
  mkdir,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { Context, Effect, Layer } from 'effect';
import { serverEnv } from '../env/server';
import { orphanedDataFiles, type StoredDataFile } from './consistency';
import { StorageError } from './storage-error';

const storageFailure = (operation: string, cause: unknown) =>
  new StorageError({
    operation,
    cause,
    message: `Storage operation failed: ${operation}.`,
  });

const dataPath = (relativePath: string): string => {
  const root = resolve(serverEnv.dataDir());
  const path = resolve(root, relativePath);
  if (!path.startsWith(`${root}${sep}`)) {
    throw new Error('Data path escapes WORDHOLD_DATA_DIR.');
  }
  return path;
};

export const pageImageRelativePath = (
  pageId: string,
  extension: string,
  suffix?: string,
): string =>
  suffix === undefined
    ? `pages/${pageId}.${extension}`
    : `pages/${pageId}-${suffix}.${extension}`;

export const audioRelativePath = (entryId: string, voice: string): string =>
  `audio/${entryId}-${voice.toLowerCase()}.mp3`;

export const exampleAudioRelativePath = (
  entryId: string,
  audioProfile: string,
): string => `audio/${entryId}-example-${audioProfile.toLowerCase()}.mp3`;

const tryStorage = <A>(operation: string, evaluate: () => Promise<A>) =>
  Effect.tryPromise({
    try: evaluate,
    catch: (cause) => storageFailure(operation, cause),
  });

const storedFiles = Effect.gen(function* () {
  const files: Array<StoredDataFile> = [];
  for (const directory of ['pages', 'audio'] as const) {
    const entries = yield* tryStorage('list data directory', async () => {
      try {
        return await readdir(dataPath(directory), { withFileTypes: true });
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return [] as ReadonlyArray<Dirent>;
        }
        throw error;
      }
    });
    for (const entry of entries) {
      if (entry.isFile()) {
        const relativePath = `${directory}/${entry.name}`;
        const metadata = yield* tryStorage('read file metadata', () =>
          stat(dataPath(relativePath)),
        );
        files.push({ relativePath, modifiedAtMs: metadata.mtimeMs });
      }
    }
  }
  return files;
});

export const removeIfPresent = async (
  remove: () => Promise<void>,
): Promise<void> => {
  try {
    await remove();
  } catch (error) {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error;
    }
  }
};

const removeFile = (operation: string, relativePath: string) =>
  tryStorage(operation, async () => {
    await removeIfPresent(() => unlink(dataPath(relativePath)));
  });

const writeFileIfAbsent = (relativePath: string, bytes: Uint8Array) =>
  tryStorage('write file if absent', async () => {
    const path = dataPath(relativePath);
    await mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
    try {
      await writeFile(path, bytes, { flag: 'wx' });
    } catch (error) {
      if (
        typeof error !== 'object' ||
        error === null ||
        !('code' in error) ||
        error.code !== 'EEXIST'
      ) {
        throw error;
      }
    }
  });

export type StorageShape = {
  readonly write: (
    relativePath: string,
    bytes: Uint8Array,
  ) => Effect.Effect<void, StorageError>;
  readonly writeIfAbsent: (
    relativePath: string,
    bytes: Uint8Array,
  ) => Effect.Effect<void, StorageError>;
  readonly read: (
    relativePath: string,
  ) => Effect.Effect<Uint8Array<ArrayBuffer>, StorageError>;
  readonly remove: (relativePath: string) => Effect.Effect<void, StorageError>;
  readonly reconcile: (
    referencedPaths: ReadonlySet<string>,
  ) => Effect.Effect<ReadonlyArray<string>, StorageError>;
};

export class Storage extends Context.Tag('@wordhold/web/storage/Storage')<
  Storage,
  StorageShape
>() {}

export const StorageLive = Layer.succeed(
  Storage,
  Storage.of({
    write: (relativePath, bytes) =>
      tryStorage('write file', async () => {
        const path = dataPath(relativePath);
        await mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
        await writeFile(path, bytes);
      }),
    writeIfAbsent: writeFileIfAbsent,
    read: (relativePath) =>
      tryStorage(
        'read file',
        async () => new Uint8Array(await readFile(dataPath(relativePath))),
      ),
    remove: (relativePath) => removeFile('remove file', relativePath),
    reconcile: (referencedPaths) =>
      storedFiles.pipe(
        Effect.flatMap((files) => {
          const orphaned = orphanedDataFiles(
            files,
            referencedPaths,
            Date.now(),
          );
          return Effect.forEach(
            orphaned,
            (relativePath) => removeFile('remove orphaned file', relativePath),
            { concurrency: 1, discard: true },
          ).pipe(Effect.as(orphaned));
        }),
      ),
  }),
);

export const toBase64 = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64');
