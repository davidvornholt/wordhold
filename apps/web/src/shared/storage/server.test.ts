import { describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { Effect } from 'effect';
import { removeIfPresent, Storage, StorageLive } from './server';

describe('removeIfPresent', () => {
  it('treats concurrent cleanup of one file as idempotent', async () => {
    let present = true;
    const remove = (): Promise<void> => {
      if (!present) {
        const error = Object.assign(new Error('already removed'), {
          code: 'ENOENT',
        });
        return Promise.reject(error);
      }
      present = false;
      return Promise.resolve();
    };

    await Promise.all([removeIfPresent(remove), removeIfPresent(remove)]);
    expect(present).toBe(false);
  });
});

// Runs a storage effect against a fresh data directory.
const inDataDirectory = async (
  run: (directory: string) => Promise<void>,
): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'wordhold-storage-'));
  const previous = process.env.WORDHOLD_DATA_DIR;
  process.env.WORDHOLD_DATA_DIR = directory;
  try {
    await run(directory);
  } finally {
    if (previous === undefined) {
      delete process.env.WORDHOLD_DATA_DIR;
    } else {
      process.env.WORDHOLD_DATA_DIR = previous;
    }
    await rm(directory, { recursive: true, force: true });
  }
};

const runStorage = <A, E>(effect: Effect.Effect<A, E, Storage>) =>
  Effect.runPromise(effect.pipe(Effect.provide(StorageLive)));

describe('StorageLive.write', () => {
  it('replaces a stored file and leaves nothing beside it', async () => {
    await inDataDirectory(async (directory) => {
      const stored = await runStorage(
        Effect.gen(function* () {
          const storage = yield* Storage;
          yield* storage.write('pages/page.png', new Uint8Array([1, 2, 3]));
          yield* storage.write('pages/page.png', new Uint8Array([4, 5]));
          return yield* storage.read('pages/page.png');
        }),
      );

      expect([...stored]).toEqual([4, 5]);
      expect(await readdir(join(directory, 'pages'))).toEqual(['page.png']);
    });
  });

  it('removes its staged copy when the file cannot be put in place', async () => {
    await inDataDirectory(async (directory) => {
      // A non-empty directory at the path makes the final rename fail.
      await mkdir(join(directory, 'pages', 'page.png'), { recursive: true });
      await writeFile(join(directory, 'pages', 'page.png', 'kept'), 'kept');

      const result = await runStorage(
        Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* Effect.result(
            storage.write('pages/page.png', new Uint8Array([1])),
          );
        }),
      );

      expect(result._tag).toBe('Failure');
      expect(await readdir(join(directory, 'pages'))).toEqual(['page.png']);
      expect(await readdir(join(directory, 'pages', 'page.png'))).toEqual([
        'kept',
      ]);
    });
  });
});
