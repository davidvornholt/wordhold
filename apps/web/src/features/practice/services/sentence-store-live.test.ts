import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  dueEntryId,
  firstReviewEntryId,
  fixtureBookId,
  fixtureCourseId,
  fixtureUnitId,
  seedIntroducedCardFixture,
  unintroducedEntryId,
} from '../../../shared/testing/introduced-card-fixture';
import { SentenceStore } from './sentence-store';

describe('SentenceStore', () => {
  it('draws introduced words and grades against their first translated example', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          const store = yield* SentenceStore;
          yield* sql`
            insert into entry_examples (entry_id, target_text, native_text, position)
            values
              (${firstReviewEntryId}, 'Je lis un livre.', 'Ich lese ein Buch.', 0),
              (${firstReviewEntryId}, 'Le livre est rouge.', 'Das Buch ist rot.', 1),
              (${dueEntryId}, 'Une mémoire courte.', null, 0)
          `;

          const items = yield* store.loadSession(fixtureCourseId, {
            unitId: fixtureUnitId,
          });
          expect(items.map(({ entryId }) => entryId).sort()).toEqual(
            [dueEntryId, firstReviewEntryId].sort(),
          );
          expect(
            items.find(({ entryId }) => entryId === firstReviewEntryId),
          ).toEqual({
            entryId: firstReviewEntryId,
            targetText: 'livre',
            nativeText: 'Buch',
          });
          // The fixture's words sit in a unit, not directly in the book.
          expect(
            yield* store.loadSession(fixtureCourseId, {
              bookId: fixtureBookId,
            }),
          ).toEqual([]);
          // Picked words follow the same rule: one not met yet is left out.
          const picked = yield* store.loadSession(fixtureCourseId, {
            entryIds: [firstReviewEntryId, unintroducedEntryId],
          });
          expect(picked.map(({ entryId }) => entryId)).toEqual([
            firstReviewEntryId,
          ]);

          expect(yield* store.readTarget(firstReviewEntryId)).toEqual({
            targetLanguage: 'fr',
            word: { target: 'livre', german: 'Buch' },
            sentence: 'Ich lese ein Buch.',
            reference: 'Je lis un livre.',
          });
          // Without a German side there is nothing to translate from.
          expect(yield* store.readTarget(dueEntryId)).toBeUndefined();
        }).pipe(
          Effect.provide(SentenceStore.live.pipe(Layer.provide(databaseLayer))),
          Effect.provide(databaseLayer),
        );
      }),
    );
  });
});
