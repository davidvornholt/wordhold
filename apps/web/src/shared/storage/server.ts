// The designated filesystem boundary: the only application module allowed to
// use Node APIs (scoped override in the root biome.jsonc). Page images and
// generated audio live under WORDHOLD_DATA_DIR, addressed by relative paths
// that are what the database stores.
import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { serverEnv } from '../env/server';

const dataPath = (relativePath: string): string =>
  `${serverEnv.dataDir()}/${relativePath}`;

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

export const toBase64 = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64');
