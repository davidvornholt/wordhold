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
  fixtureCourseId,
  fixtureUnitId,
  seedIntroducedCardFixture,
  unintroducedEntryId,
} from '../../../shared/testing/introduced-card-fixture';
import { PracticeSessionStore } from './session-store';

const selectedEntryCount = 3;

describe('PracticeSessionStore selected practice', () => {
  it('loads every selected card and permits a direction outside the regular plan', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          const store = yield* PracticeSessionStore;

          const mixed = yield* store.loadSelection({
            courseId: fixtureCourseId,
            direction: 'both',
            selection: { unitId: fixtureUnitId },
          });
          expect(
            mixed
              .map(({ entryId, direction }) => `${entryId}:${direction}`)
              .sort(),
          ).toEqual(
            [
              `${dueEntryId}:to_native`,
              `${dueEntryId}:to_target`,
              `${firstReviewEntryId}:to_native`,
              `${firstReviewEntryId}:to_target`,
              `${unintroducedEntryId}:to_native`,
              `${unintroducedEntryId}:to_target`,
            ].sort(),
          );
          const target = yield* store.loadSelection({
            courseId: fixtureCourseId,
            direction: 'to_target',
            selection: { unitId: fixtureUnitId },
          });
          expect(target.map(({ direction }) => direction)).toEqual([
            'to_target',
            'to_target',
            'to_target',
          ]);

          yield* sql`
            update courses
            set directions = '{to_native}'::answer_direction[]
            where id = ${fixtureCourseId}
          `;
          expect(
            yield* store.loadSelection({
              courseId: fixtureCourseId,
              direction: 'to_target',
              selection: { unitId: fixtureUnitId },
            }),
          ).toHaveLength(selectedEntryCount);
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
