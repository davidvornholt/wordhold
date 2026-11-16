import { describe, expect, it } from 'bun:test';
import { SentenceGen } from '@wordhold/ai/sentence';
import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  fixtureCourseId as courseId,
  firstReviewEntryId as entryId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { VocabularyEntryStore } from './vocabulary-entry-store';
import { generateMissingExample } from './vocabulary-example-preparation';
import { VocabularyExampleStore } from './vocabulary-example-store';

// The fixture's word is livre → Buch; the learner corrects it to another.
const correction = {
  courseId,
  entryId,
  revision: 0,
  targetText: 'chat',
  nativeText: 'die Katze',
  synonyms: null,
  antonyms: null,
};
const oldWordsExample = {
  targetText: 'Je lis un livre.',
  nativeText: 'Ich lese ein Buch.',
};

const runTest = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    Database | VocabularyEntryStore | VocabularyExampleStore
  >,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        return yield* effect;
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            VocabularyEntryStore.live,
            VocabularyExampleStore.live,
          ),
        ),
        Effect.provide(databaseLayer),
      );
    }),
  );

// The edit runs as its own request, on a connection of its own, as a second
// tab or the CLI would.
const editElsewhere = (store: VocabularyEntryStore['Service']) =>
  Effect.runPromise(store.update(correction));

// Until another backend waits for one of this backend's locks, so the test
// can't pass merely because the edit hadn't started yet. It reads pg_locks,
// because pg_stat_activity stays as first read for the caller's transaction.
const waitUntilBlockedBy = (sql: Database, pid: number) =>
  Effect.gen(function* () {
    for (;;) {
      const [waiting] = yield* sql<{ readonly blocked: boolean }>`
        select exists (
          select 1 from pg_locks
          where not granted and ${pid} = any(pg_blocking_pids(pid))
        ) as blocked
      `;
      if (waiting?.blocked === true) {
        return;
      }
      yield* Effect.sleep('10 millis');
    }
  }).pipe(Effect.timeout('3 seconds'), Effect.orDie);

describe('VocabularyExampleStore and a concurrent correction', () => {
  it('drops an example generated for the word as it was before the edit', async () => {
    const after = await runTest(
      Effect.gen(function* () {
        const words = yield* VocabularyEntryStore;
        const examples = yield* VocabularyExampleStore;
        const context = yield* examples.read(entryId);
        if (context === undefined) {
          return yield* Effect.die('Expected the fixture word.');
        }
        // The edit lands while the provider is still writing the sentence.
        const generator = SentenceGen.of({
          generate: (request) =>
            Effect.gen(function* () {
              expect(request.targetText).toBe('livre');
              yield* Effect.promise(() => editElsewhere(words));
              return {
                sentences: [
                  {
                    target: oldWordsExample.targetText,
                    native: oldWordsExample.nativeText,
                  },
                ],
              };
            }),
          translate: () => Effect.die('Not used.'),
          translateWord: () => Effect.die('Not used.'),
        });
        const failure = yield* examples
          .withCriticalSection(
            entryId,
            generateMissingExample(context, generator, examples),
          )
          .pipe(Effect.provide(untrackedAiUsage), Effect.flip);
        expect(failure._tag).toBe('CourseExampleGenerationError');
        return yield* examples.read(entryId);
      }),
    );
    expect(after).toMatchObject({ targetText: 'chat', example: null });
  });

  it('lets an edit that waited for a stored example correct it', async () => {
    const after = await runTest(
      Effect.gen(function* () {
        const sql = yield* Database;
        const words = yield* VocabularyEntryStore;
        const examples = yield* VocabularyExampleStore;
        let editDone = false;
        const edit = yield* examples.withCriticalSection(
          entryId,
          Effect.gen(function* () {
            const [backend] = yield* sql<{ readonly pid: number }>`
              select pg_backend_pid() as pid
            `;
            expect(
              yield* examples.storeGenerated(
                { entryId, targetText: 'livre', nativeText: 'Buch' },
                oldWordsExample,
              ),
            ).toMatchObject(oldWordsExample);
            // Preparation goes on to the audio before it commits; the edit
            // waits for it rather than read the entry without the example.
            const pending = editElsewhere(words).then((result) => {
              editDone = true;
              return result;
            });
            yield* waitUntilBlockedBy(sql, backend?.pid ?? 0);
            expect(editDone).toBe(false);
            return pending;
          }),
        );
        expect((yield* Effect.promise(() => edit)).kind).toBe('updated');
        return yield* examples.read(entryId);
      }),
    );
    // The edit came without an example, so the old word's sentence is gone.
    expect(after).toMatchObject({ targetText: 'chat', example: null });
  });
});
