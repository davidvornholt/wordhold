import { describe, expect, it } from 'bun:test';
import { SentenceGen } from '@wordhold/ai/sentence';
import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import { Tts } from '@wordhold/ai/tts';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Deferred, Effect, Fiber, Layer, Schedule } from 'effect';
import { Storage } from '../../../shared/storage/server';
import {
  fixtureCourseId,
  seedIntroducedCardFixture,
  unintroducedEntryId,
} from '../../../shared/testing/introduced-card-fixture';
import { makeStorage } from '../../import/services/test-services';
import { VocabularyEntryService } from './vocabulary-entry-service';
import { VocabularyEntryStore } from './vocabulary-entry-store';

// The fixture stores this entry as 'neuf', 'neu'.
const unchanged = {
  courseId: fixtureCourseId,
  entryId: unintroducedEntryId,
  targetText: 'neuf',
  nativeText: 'neu',
  synonyms: null,
  antonyms: null,
};

const noSentences = SentenceGen.of({
  generate: () => Effect.die('Unexpected sentence call'),
  translate: () => Effect.die('Unexpected translate call'),
  translateWord: () => Effect.die('Unexpected translate call'),
});

// Stored files by path, so a test can tell which word a recording speaks.
const serviceWith = (tts: Tts['Service'], files: Map<string, Uint8Array>) =>
  VocabularyEntryService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        VocabularyEntryStore.live,
        Layer.succeed(SentenceGen, noSentences),
        Layer.succeed(Tts, tts),
        Layer.succeed(
          Storage,
          makeStorage({
            write: (path, audio) =>
              Effect.sync(() => {
                files.set(path, audio);
              }),
            remove: (path) =>
              Effect.sync(() => {
                files.delete(path);
              }),
          }),
        ),
      ),
    ),
  );

const spoken = (files: Map<string, Uint8Array>, path: string | undefined) =>
  new TextDecoder().decode(path === undefined ? undefined : files.get(path));

describe('saving a word while its pronunciation is generated', () => {
  it('keeps the recording of the corrected word when a slower save finishes last', async () => {
    const files = new Map<string, Uint8Array>();
    const started = Deferred.makeUnsafe<void>();
    const release = Deferred.makeUnsafe<void>();
    // Only the first word is slow: its speech waits until it is released.
    const tts = Tts.of({
      synthesize: ({ text }) =>
        Effect.gen(function* () {
          if (text === 'neuf') {
            yield* Deferred.succeed(started, undefined);
            yield* Deferred.await(release);
          }
          return { audio: new TextEncoder().encode(text) };
        }),
    });
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          const service = yield* VocabularyEntryService;

          const slow = yield* service.update(unchanged).pipe(Effect.forkChild);
          yield* Deferred.await(started);
          const correction = yield* service
            .update({ ...unchanged, targetText: 'nouveau' })
            .pipe(Effect.forkChild);
          // The correction is stored while the first recording is still pending.
          yield* Effect.gen(function* () {
            const [stored] = yield* sql<{ text: string }>`
              select target_text as text from entries where id = ${unintroducedEntryId}
            `;
            if (stored?.text !== 'nouveau') {
              return yield* Effect.fail('pending' as const);
            }
          }).pipe(
            Effect.retry({
              times: 100,
              schedule: Schedule.spaced('20 millis'),
            }),
          );
          yield* Deferred.succeed(release, undefined);
          yield* Fiber.join(slow);
          yield* Fiber.join(correction);

          const [row] = yield* sql<{ text: string; path: string }>`
            select e.target_text as text, a.path
            from entries e join entry_audio a on a.entry_id = e.id
            where e.id = ${unintroducedEntryId}
          `;
          expect(row?.text).toBe('nouveau');
          expect(spoken(files, row?.path)).toBe('nouveau');
        }).pipe(
          Effect.provide(serviceWith(tts, files)),
          Effect.provide(testDatabaseLayer(database.url)),
          Effect.provide(untrackedAiUsage),
        ),
      ),
    );
  });

  it('saves the edit and reports a failed pronunciation when the audio reference is rejected', async () => {
    const files = new Map<string, Uint8Array>();
    const tts = Tts.of({
      synthesize: () => Effect.succeed({ audio: new Uint8Array([1]) }),
    });
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          // The database refuses every audio reference, as a broken constraint would.
          yield* sql`alter table entry_audio add constraint test_reject_audio check (false)`;
          const service = yield* VocabularyEntryService;

          const saved = yield* service.update({
            ...unchanged,
            nativeText: 'erneuert',
          });

          expect(saved).toEqual({ audio: 'failed' });
          const [row] = yield* sql<{ text: string }>`
            select native_text as text from entries where id = ${unintroducedEntryId}
          `;
          expect(row?.text).toBe('erneuert');
        }).pipe(
          Effect.provide(serviceWith(tts, files)),
          Effect.provide(testDatabaseLayer(database.url)),
          Effect.provide(untrackedAiUsage),
        ),
      ),
    );
  });
});
