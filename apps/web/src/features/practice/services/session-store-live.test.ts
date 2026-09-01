import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { sessionSectionSize } from '../../../shared/session/section-policy';
import {
  dueEntryId,
  firstReviewEntryId,
  fixtureCourseId,
  fixtureNow,
  fixtureUnitId,
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
          const session = yield* store.loadScheduled(
            fixtureCourseId,
            'both',
            null,
            fixtureNow,
          );
          expect(session.items.map((item) => item.entryId)).toEqual([
            dueEntryId,
            firstReviewEntryId,
            firstReviewEntryId,
          ]);
          expect(session.availability).toEqual({
            due: 1,
            firstReviews: 2,
            ready: 3,
            nextDueAt: new Date('2026-08-21T12:00:00.000Z'),
          });
          const unitSession = yield* store.loadScheduled(
            fixtureCourseId,
            'both',
            fixtureUnitId,
            fixtureNow,
          );
          expect(unitSession.items).toHaveLength(session.items.length);
          const outsideUnit = yield* store.loadScheduled(
            fixtureCourseId,
            'both',
            dueEntryId,
            fixtureNow,
          );
          expect(outsideUnit.items).toEqual([]);
          expect(outsideUnit.availability.ready).toBe(0);
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

describe('PracticeSessionStore queue policy', () => {
  it('keeps disabled directions out of mixed and explicit queues', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          const store = yield* PracticeSessionStore;
          yield* sql`
            update courses
            set directions = '{to_native}'::answer_direction[]
            where id = ${fixtureCourseId}
          `;

          const mixed = yield* store.loadScheduled(
            fixtureCourseId,
            'both',
            null,
            fixtureNow,
          );
          expect(mixed.items.map((item) => item.direction)).toEqual([
            'to_native',
          ]);
          const disabled = yield* store.loadScheduled(
            fixtureCourseId,
            'to_target',
            null,
            fixtureNow,
          );
          expect(disabled.items).toEqual([]);
          expect(disabled.availability.ready).toBe(0);
        }).pipe(
          Effect.provide(
            PracticeSessionStore.live.pipe(Layer.provide(databaseLayer)),
          ),
          Effect.provide(databaseLayer),
        );
      }),
    );
  });

  it('caps a section at twenty and never displaces overdue reviews with first reviews', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          const store = yield* PracticeSessionStore;
          yield* sql`
            insert into entries (
              course_id, unit_id, target_text, native_text
            )
            select ${fixtureCourseId}, ${fixtureUnitId},
              'overdue-' || number, 'überfällig-' || number
            from generate_series(1, 25) as number
          `;
          yield* sql`
            insert into cards (
              entry_id, direction, introduced_at, state, due_at,
              stability, difficulty, reps, scheduled_days, last_reviewed_at
            )
            select id, 'to_target', ${fixtureNow}, 'review',
              ${fixtureNow}::timestamptz - interval '1 day', 10, 5, 4, 10,
              ${fixtureNow}::timestamptz - interval '11 days'
            from entries where target_text like 'overdue-%'
          `;

          const session = yield* store.loadScheduled(
            fixtureCourseId,
            'both',
            null,
            fixtureNow,
          );
          expect(session.items).toHaveLength(sessionSectionSize);
          expect(
            session.items.some((item) => item.entryId === firstReviewEntryId),
          ).toBe(false);
          expect(session.availability).toMatchObject({
            due: 26,
            firstReviews: 2,
            ready: sessionSectionSize,
          });
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
