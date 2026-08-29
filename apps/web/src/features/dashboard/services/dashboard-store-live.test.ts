import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
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
  it('separates unintroduced entries from first reviews and due cards', async () => {
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
            firstReviews: 2,
            ready: 3,
            unintroduced: 1,
            entries: 3,
            nextDueAt: new Date('2026-08-21T12:00:00.000Z'),
            directions: expect.any(Array),
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

  it('filters disabled directions and restores them without touching cards', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          const store = yield* DashboardStore;
          const before = yield* sql<{
            readonly direction: string;
            readonly dueAt: unknown;
            readonly id: string;
            readonly introducedAt: unknown;
            readonly revision: number;
            readonly state: string;
          }>`
            select id, direction, revision, state,
              due_at as "dueAt", introduced_at as "introducedAt"
            from cards order by id
          `;

          yield* sql`
            update courses
            set directions = '{to_native}'::answer_direction[]
            where id = ${fixtureCourseId}
          `;
          expect(yield* store.courseCounts(fixtureNow)).toContainEqual({
            courseId: fixtureCourseId,
            due: 0,
            firstReviews: 1,
            ready: 1,
            unintroduced: 1,
            entries: 3,
            nextDueAt: new Date('2026-08-21T12:00:00.000Z'),
            directions: expect.any(Array),
          });

          yield* sql`
            update courses
            set directions = '{to_target,to_native}'::answer_direction[]
            where id = ${fixtureCourseId}
          `;
          expect(yield* store.courseCounts(fixtureNow)).toContainEqual({
            courseId: fixtureCourseId,
            due: 1,
            firstReviews: 2,
            ready: 3,
            unintroduced: 1,
            entries: 3,
            nextDueAt: new Date('2026-08-21T12:00:00.000Z'),
            directions: expect.any(Array),
          });
          const after = yield* sql<(typeof before)[number]>`
            select id, direction, revision, state,
              due_at as "dueAt", introduced_at as "introducedAt"
            from cards order by id
          `;
          expect(after).toEqual(before);
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
