import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import {
  dueEntryId,
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
            known: 1,
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
            known: 1,
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
            known: 1,
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

const fixtureKnownCount = (
  counts: ReadonlyArray<{ readonly courseId: string; readonly known: number }>,
) => counts.find((course) => course.courseId === fixtureCourseId)?.known;

describe('DashboardStore known-entry contract', () => {
  it('counts an entry as known only when every enabled direction is in review', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          const store = yield* DashboardStore;
          const known = () =>
            Effect.map(store.courseCounts(fixtureNow), fixtureKnownCount);

          yield* sql`
            update cards set state = 'relearning'
            where entry_id = ${dueEntryId} and direction = 'to_target'
          `;
          expect(yield* known()).toBe(0);

          yield* sql`
            update courses
            set directions = '{to_native}'::answer_direction[]
            where id = ${fixtureCourseId}
          `;
          expect(yield* known()).toBe(1);
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

describe('DashboardStore practiced-day contract', () => {
  it('buckets answers into owner-local days and drops older ones', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          const store = yield* DashboardStore;
          const cardRows = yield* sql<{ readonly id: string }>`
            select id from cards where entry_id = ${dueEntryId} limit 1
          `;
          const cardId = cardRows.at(0)?.id;
          if (cardId === undefined) {
            throw new Error('Expected the seeded due card.');
          }
          yield* sql`
            insert into reviews (card_id, reviewed_at, rating, mode, answer_text)
            values
              (${cardId}, ${new Date('2026-08-19T22:30:00.000Z')}, ${ratings.good}, 'scheduled', 'a'),
              (${cardId}, ${new Date('2026-08-20T06:00:00.000Z')}, ${ratings.good}, 'scheduled', 'b'),
              (${cardId}, ${new Date('2026-08-01T12:00:00.000Z')}, ${ratings.good}, 'scheduled', 'c')
          `;

          const days = yield* store.practicedDays(
            new Date('2026-08-10T00:00:00.000Z'),
            'Europe/Berlin',
          );
          expect([...days].sort()).toEqual(['2026-08-20']);

          const utcDays = yield* store.practicedDays(
            new Date('2026-08-10T00:00:00.000Z'),
            'UTC',
          );
          expect([...utcDays].sort()).toEqual(['2026-08-19', '2026-08-20']);
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

describe('DashboardStore fragile-entry contract', () => {
  it('hides fragile entries when all failures are in disabled directions', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          const store = yield* DashboardStore;
          const targetCard = yield* sql<{ readonly id: string }>`
            select c.id
            from cards c
            join entries e on e.id = c.entry_id
            where e.id = ${dueEntryId} and c.direction = 'to_target'
          `;
          const card = targetCard.at(0);
          if (card === undefined) {
            throw new Error('Expected the seeded target card.');
          }
          yield* sql`
            insert into reviews
              (card_id, reviewed_at, rating, mode, answer_text)
            values
              (${card.id}, now(), ${ratings.again}, 'scheduled', 'falsch'),
              (${card.id}, now(), ${ratings.again}, 'scheduled', 'immer noch falsch')
          `;

          expect(yield* store.fragileEntries()).toContainEqual(
            expect.objectContaining({ entryId: dueEntryId, failures: 2 }),
          );

          yield* sql`
            update courses
            set directions = '{to_native}'::answer_direction[]
            where id = ${fixtureCourseId}
          `;
          expect(yield* store.fragileEntries()).not.toContainEqual(
            expect.objectContaining({ entryId: dueEntryId }),
          );

          yield* sql`
            update courses
            set directions = '{to_target,to_native}'::answer_direction[]
            where id = ${fixtureCourseId}
          `;
          expect(yield* store.fragileEntries()).toContainEqual(
            expect.objectContaining({ entryId: dueEntryId, failures: 2 }),
          );
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
