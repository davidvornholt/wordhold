import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { MediaDatabaseError } from './media-database-error';
import { MediaNotFoundError } from './media-not-found-error';
import {
  loadEntryAudio,
  MediaRepository,
  type MediaRepositoryShape,
} from './media-service';
import { Storage, type StorageShape } from './server';
import { StorageError } from './storage-error';

const repository = (
  overrides: Partial<MediaRepositoryShape> = {},
): MediaRepositoryShape => ({
  audioPath: () => Effect.succeed('audio/entry-amy.mp3'),
  pageImagePath: () => Effect.succeed('pages/page.png'),
  ...overrides,
});

const storage = (overrides: Partial<StorageShape> = {}): StorageShape => ({
  write: () => Effect.void,
  read: () => Effect.succeed(new Uint8Array([1])),
  remove: () => Effect.void,
  reconcile: () => Effect.succeed([]),
  ...overrides,
});

const runFailure = (
  mediaRepository: MediaRepositoryShape,
  dataStorage: StorageShape,
) =>
  Effect.runPromise(
    Effect.flip(
      loadEntryAudio('entry').pipe(
        Effect.provideService(MediaRepository, mediaRepository),
        Effect.provideService(Storage, dataStorage),
      ),
    ),
  );

describe('loadEntryAudio', () => {
  it('retains a database failure without reading storage', async () => {
    let storageReads = 0;
    const failure = new MediaDatabaseError({
      cause: new Error('database unavailable'),
      message: 'database unavailable',
    });
    const result = await runFailure(
      repository({ audioPath: () => Effect.fail(failure) }),
      storage({
        read: () => {
          storageReads += 1;
          return Effect.succeed(new Uint8Array());
        },
      }),
    );
    expect(result).toBe(failure);
    expect(storageReads).toBe(0);
  });

  it('distinguishes a missing reference from storage failure', async () => {
    const missing = await runFailure(
      repository({ audioPath: () => Effect.succeed(undefined) }),
      storage(),
    );
    expect(missing).toBeInstanceOf(MediaNotFoundError);

    const failure = new StorageError({
      operation: 'read file',
      cause: new Error('disk unavailable'),
      message: 'disk unavailable',
    });
    const unreadable = await runFailure(
      repository(),
      storage({ read: () => Effect.fail(failure) }),
    );
    expect(unreadable).toBe(failure);
  });
});
