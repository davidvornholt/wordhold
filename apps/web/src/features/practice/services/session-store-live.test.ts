import { describe, expect, it } from 'bun:test';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  dueEntryId,
  fixtureCourseId,
  fixtureNow,
  freshEntryId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { PracticeSessionStore } from './session-store';

describe('PracticeSessionStore introduction contract', () => {
  it('offers only introduced cards in their current queue', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const store = yield* PracticeSessionStore;
          const session = yield* store.load(fixtureCourseId, fixtureNow);
          expect(session.due.map((item) => item.entryId)).toEqual([dueEntryId]);
          expect(session.fresh.map((item) => item.entryId)).toEqual([
            freshEntryId,
            freshEntryId,
          ]);
        }).pipe(
          Effect.provide(
            PracticeSessionStore.live.pipe(Layer.provide(databaseLayer)),
          ),
          Effect.provide(databaseLayer),
        );
      }),
    );
  });
});
