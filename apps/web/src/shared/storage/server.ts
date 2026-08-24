// The designated filesystem boundary: the only application module allowed to
// use Node APIs (scoped override in the root biome.jsonc). Page images and
// generated audio live under WORDHOLD_DATA_DIR, addressed by relative paths
// that are what the database stores.
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
import { serverEnv } from '../env/server';
import { orphanedDataFiles, type StoredDataFile } from './consistency';

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
): string => `pages/${pageId}.${extension}`;

export const audioRelativePath = (entryId: string, voice: string): string =>
  `audio/${entryId}-${voice.toLowerCase()}.mp3`;

export const writeDataFile = async (
  relativePath: string,
  bytes: Uint8Array,
): Promise<void> => {
  const path = dataPath(relativePath);
  await mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  await writeFile(path, bytes);
};

export const readDataFile = async (
  relativePath: string,
): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(await readFile(dataPath(relativePath)));

export const removeDataFile = async (relativePath: string): Promise<void> => {
  try {
    await unlink(dataPath(relativePath));
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

const storedFiles = async (): Promise<ReadonlyArray<StoredDataFile>> => {
  const files: Array<StoredDataFile> = [];
  for (const directory of ['pages', 'audio'] as const) {
    let entries: ReadonlyArray<Dirent> = [];
    try {
      // biome-ignore lint/performance/noAwaitInLoops: two known directories are read in order to keep failure reporting deterministic
      entries = await readdir(dataPath(directory), { withFileTypes: true });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        entries = [];
      } else {
        throw error;
      }
    }
    for (const entry of entries) {
      if (entry.isFile()) {
        const relativePath = `${directory}/${entry.name}`;
        // biome-ignore lint/performance/noAwaitInLoops: metadata order must match the stable directory listing
        const metadata = await stat(dataPath(relativePath));
        files.push({ relativePath, modifiedAtMs: metadata.mtimeMs });
      }
    }
  }
  return files;
};

export const reconcileDataFiles = async (
  referencedPaths: ReadonlySet<string>,
): Promise<ReadonlyArray<string>> => {
  const orphaned = orphanedDataFiles(
    await storedFiles(),
    referencedPaths,
    Date.now(),
  );
  for (const relativePath of orphaned) {
    // biome-ignore lint/performance/noAwaitInLoops: deterministic deletion makes a failed path actionable
    await removeDataFile(relativePath);
  }
  return orphaned;
};

export const toBase64 = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64');
