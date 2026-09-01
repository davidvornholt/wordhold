import { describe, expect, it } from 'bun:test';
import { ttsAudioProfile } from '@wordhold/ai/tts/speech-text';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { MediaDatabaseError } from './media-database-error';
import { MediaNotFoundError } from './media-not-found-error';
import {
  loadEntryAudio,
  loadExampleAudio,
  MediaRepository,
  MediaRepositoryLive,
  type MediaRepositoryShape,
} from './media-service';
import { Storage, type StorageShape } from './server';
import { StorageError } from './storage-error';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const unitId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const entryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const repository = (
  overrides: Partial<MediaRepositoryShape> = {},
): MediaRepositoryShape => ({
  audioPath: () => Effect.succeed('audio/entry-amy.mp3'),
  exampleAudioPath: () => Effect.succeed('audio/entry-example-amy.mp3'),
  pageImagePath: () => Effect.succeed('pages/page.png'),
  ...overrides,
});

const storage = (overrides: Partial<StorageShape> = {}): StorageShape => ({
  write: () => Effect.void,
  writeIfAbsent: () => Effect.void,
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

  it('does not serve word or example audio with stale profiles', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        let storageReads = 0;
        const dataStorage = storage({
          read: () => {
            storageReads += 1;
            return Effect.succeed(new Uint8Array([1]));
          },
        });
        return Effect.gen(function* () {
          const sql = yield* Database;
          yield* sql`
            insert into courses (id, name, target_language)
            values (${courseId}, 'French', 'fr')
          `;
          yield* sql`
            insert into units (id, course_id, name, position)
            values (${unitId}, ${courseId}, 'Unit 1', 0)
          `;
          yield* sql`
            insert into entries (id, course_id, unit_id, target_text, native_text)
            values (${entryId}, ${courseId}, ${unitId}, 'mémoire', 'Erinnerung')
          `;
          yield* sql`
            insert into entry_audio (entry_id, voice, path)
            values (${entryId}, 'Lea', 'audio/old.mp3')
          `;
          yield* sql`
            insert into entry_examples (
              entry_id, target_text, native_text, source, position,
              audio_profile, audio_path
            ) values (
              ${entryId}, 'Je garde cette mémoire.',
              'Ich bewahre diese Erinnerung.', 'textbook', 0,
              'Lea', 'audio/old-example.mp3'
            )
          `;

          const staleWord = yield* Effect.either(
            loadEntryAudio(entryId).pipe(
              Effect.provideService(Storage, dataStorage),
            ),
          );
          const staleExample = yield* Effect.either(
            loadExampleAudio(entryId).pipe(
              Effect.provideService(Storage, dataStorage),
            ),
          );
          expect(staleWord._tag).toBe('Left');
          expect(staleExample._tag).toBe('Left');
          expect(storageReads).toBe(0);

          yield* sql`
            update entry_audio
            set voice = ${ttsAudioProfile('mémoire', 'fr')}
            where entry_id = ${entryId}
          `;
          yield* sql`
            update entry_examples
            set audio_profile = ${ttsAudioProfile('Je garde cette mémoire.', 'fr')}
            where entry_id = ${entryId}
          `;
          const currentWord = yield* loadEntryAudio(entryId).pipe(
            Effect.provideService(Storage, dataStorage),
          );
          const currentExample = yield* loadExampleAudio(entryId).pipe(
            Effect.provideService(Storage, dataStorage),
          );
          expect(currentWord.bytes).toEqual(new Uint8Array([1]));
          expect(currentExample.bytes).toEqual(new Uint8Array([1]));
          expect(storageReads).toBe(2);
        }).pipe(
          Effect.provide(
            MediaRepositoryLive.pipe(Layer.provide(databaseLayer)),
          ),
          Effect.provide(databaseLayer),
        );
      }),
    );
  });
});

describe('loadExampleAudio', () => {
  it('loads the sentence recording through the same storage boundary', async () => {
    const result = await Effect.runPromise(
      loadExampleAudio('entry').pipe(
        Effect.provideService(MediaRepository, repository()),
        Effect.provideService(Storage, storage()),
      ),
    );
    expect(result.path).toBe('audio/entry-example-amy.mp3');
  });
});
