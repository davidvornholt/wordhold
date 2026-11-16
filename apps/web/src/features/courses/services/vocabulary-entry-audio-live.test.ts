import { describe, expect, it } from 'bun:test';
import { SentenceGen } from '@wordhold/ai/sentence';
import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import { Tts } from '@wordhold/ai/tts';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Deferred, Effect, Fiber, Layer } from 'effect';
import { Storage } from '../../../shared/storage/server';
import {
  fixtureBookId,
  fixtureCourseId,
  fixtureUnitId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { makeStorage } from '../../import/services/test-services';
import { VocabularyEntryService } from './vocabulary-entry-service';
import { VocabularyEntryStore } from './vocabulary-entry-store';

const word = {
  courseId: fixtureCourseId,
  bookId: fixtureBookId,
  unitId: fixtureUnitId,
  targetText: 'le nuage',
  nativeText: 'die Wolke',
};

const noSentences = SentenceGen.of({
  generate: () => Effect.die('Unexpected sentence call'),
  translate: () => Effect.die('Unexpected translate call'),
  translateWord: () => Effect.die('Unexpected translate call'),
});

// A speech generator that counts its calls. The first `stalledCalls` of them
// never finish, like a process that stops while speech is pending.
const speech = (stalledCalls: number) => {
  let calls = 0;
  const started = Deferred.makeUnsafe<void>();
  const tts = Tts.of({
    synthesize: () =>
      Effect.suspend(() => {
        calls += 1;
        if (calls <= stalledCalls) {
          Deferred.doneUnsafe(started, Effect.void);
          return Effect.never;
        }
        return Effect.succeed({ audio: new Uint8Array([1, 2, 3]) });
      }),
  });
  return { tts, started, calls: () => calls };
};

const serviceWith = (tts: Tts['Service']) =>
  VocabularyEntryService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        VocabularyEntryStore.live,
        Layer.succeed(Storage, makeStorage()),
        Layer.succeed(SentenceGen, noSentences),
        Layer.succeed(Tts, tts),
      ),
    ),
  );

const audioRows = (entryId: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    return yield* sql<{ readonly voice: string }>`
      select voice from entry_audio where entry_id = ${entryId}
    `;
  });

describe('a manual word whose creation stopped while speech was pending', () => {
  it('gets its pronunciation from the next unchanged save, once', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;

          // The word is committed, then speech never answers and the work is
          // cut off, as when the process stops.
          const stalled = speech(1);
          const interrupted = yield* Effect.flatMap(
            VocabularyEntryService,
            (service) => service.create(word),
          ).pipe(
            Effect.provide(serviceWith(stalled.tts)),
            Effect.provide(untrackedAiUsage),
            Effect.forkChild,
          );
          yield* Deferred.await(stalled.started);
          yield* Fiber.interrupt(interrupted);

          const [stored] = yield* sql<{
            readonly id: string;
            readonly revision: number;
          }>`
            select id, revision from entries where target_text = ${word.targetText}
          `;
          if (stored === undefined) {
            return yield* Effect.die('The word should have been committed.');
          }
          expect(yield* audioRows(stored.id)).toEqual([]);

          // After the restart a healthy speech generator is available.
          const healthy = speech(0);
          const save = Effect.flatMap(VocabularyEntryService, (service) =>
            service.update({
              courseId: fixtureCourseId,
              entryId: stored.id,
              revision: stored.revision,
              targetText: word.targetText,
              nativeText: word.nativeText,
              synonyms: null,
              antonyms: null,
            }),
          ).pipe(
            Effect.provide(serviceWith(healthy.tts)),
            Effect.provide(untrackedAiUsage),
          );

          expect(yield* save).toEqual({ audio: 'generated' });
          expect(yield* audioRows(stored.id)).toHaveLength(1);

          // With the pronunciation stored, a further save calls no provider.
          expect(yield* save).toEqual({ audio: 'kept' });
          expect(healthy.calls()).toBe(1);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });
});
