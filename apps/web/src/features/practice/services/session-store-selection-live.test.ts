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
} from '../../../shared/testing/introduced-card-fixture';
import { PracticeSessionStore } from './session-store';

// The unit's third entry has not been learned, so it is never asked.
const introducedEntryCount = 2;

describe('PracticeSessionStore selected practice', () => {
  it('loads every learned card of the selection, and a switched-off direction only when asked', async () => {
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
            includeSwitchedOff: true,
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
            ].sort(),
          );
          const target = yield* store.loadSelection({
            courseId: fixtureCourseId,
            direction: 'to_target',
            selection: { unitId: fixtureUnitId },
            includeSwitchedOff: true,
          });
          expect(target.map(({ direction }) => direction)).toEqual([
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
              includeSwitchedOff: true,
            }),
          ).toHaveLength(introducedEntryCount);
          expect(
            yield* store.loadSelection({
              courseId: fixtureCourseId,
              direction: 'to_target',
              selection: { unitId: fixtureUnitId },
              includeSwitchedOff: false,
            }),
          ).toEqual([]);
          const planned = yield* store.loadSelection({
            courseId: fixtureCourseId,
            direction: 'both',
            selection: { unitId: fixtureUnitId },
            includeSwitchedOff: false,
          });
          expect(planned.map(({ direction }) => direction)).toEqual([
            'to_native',
            'to_native',
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
