import { describe, expect, it } from 'bun:test';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  fixtureCourseId,
  fixtureNow,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { DashboardStore } from './dashboard-store';

describe('DashboardStore introduction contract', () => {
  it('separates unseen words from introduced fresh and due cards', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const store = yield* DashboardStore;
          const counts = yield* store.courseCounts(fixtureNow);
          expect(counts).toContainEqual({
            courseId: fixtureCourseId,
            due: 1,
            fresh: 2,
            unlearned: 1,
            words: 3,
          });
        }).pipe(
          Effect.provide(
            DashboardStore.live.pipe(Layer.provide(databaseLayer)),
          ),
          Effect.provide(databaseLayer),
        );
      }),
    );
  });
});
