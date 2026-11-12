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
  fixtureNow,
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

describe('PracticeSessionStore test rounds', () => {
  it('loads the round cards not yet answered in that round', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          const store = yield* PracticeSessionStore;
          const [exam] = yield* sql<{ readonly id: string }>`
            insert into exams (course_id, name, directions)
            values (${fixtureCourseId}, 'Vokabeltest', '{to_target,to_native}')
            returning id
          `;
          const [round, earlier] = yield* sql<{ readonly id: string }>`
            insert into exam_rounds (exam_id)
            values (${exam?.id}), (${exam?.id})
            returning id
          `;
          const roundId = round?.id ?? '';
          const earlierId = earlier?.id ?? '';
          yield* sql`
            insert into exam_round_cards (round_id, card_id)
            select r.id, c.id from cards c
            cross join (values (${roundId}::uuid), (${earlierId}::uuid)) as r(id)
            where c.entry_id = ${dueEntryId}
          `;
          // Answered in an earlier round, which says nothing about this one.
          yield* sql`
            insert into reviews (card_id, rating, answer_text, mode, exam_round_id)
            select c.id, 3, 'mémoire', 'drill', ${earlierId}
            from cards c
            where c.entry_id = ${dueEntryId} and c.direction = 'to_native'
          `;
          expect(yield* store.loadExamRound(roundId)).toHaveLength(2);
          yield* sql`
            insert into reviews (card_id, rating, answer_text, mode, exam_round_id)
            select c.id, 1, 'souvenir', 'drill', ${roundId}
            from cards c
            where c.entry_id = ${dueEntryId} and c.direction = 'to_target'
          `;
          const left = yield* store.loadExamRound(roundId);
          expect(
            left.map(({ entryId, direction }) => `${entryId}:${direction}`),
          ).toEqual([`${dueEntryId}:to_native`]);
        }).pipe(
          Effect.provide(
            PracticeSessionStore.live.pipe(Layer.provide(databaseLayer)),
          ),
          Effect.provide(databaseLayer),
        );
      }),
    );
  });

  it('skips a round card returned to learning until it is learned again', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          const store = yield* PracticeSessionStore;
          const [exam] = yield* sql<{ readonly id: string }>`
            insert into exams (course_id, name, directions)
            values (${fixtureCourseId}, 'Vokabeltest', '{to_target,to_native}')
            returning id
          `;
          const [round] = yield* sql<{ readonly id: string }>`
            insert into exam_rounds (exam_id) values (${exam?.id}) returning id
          `;
          const roundId = round?.id ?? '';
          yield* sql`
            insert into exam_round_cards (round_id, card_id)
            select ${roundId}, c.id from cards c
            where c.entry_id = ${firstReviewEntryId}
          `;
          const roundTotal = sql<{ readonly total: number }>`
            select count(*)::int as total from exam_round_cards
            where round_id = ${roundId}
          `;
          // As returning the card to learning on the course page does.
          yield* sql`
            update cards set introduced_at = null
            where entry_id = ${firstReviewEntryId} and direction = 'to_target'
          `;
          const left = yield* store.loadExamRound(roundId);
          expect(
            left.map(({ entryId, direction }) => `${entryId}:${direction}`),
          ).toEqual([`${firstReviewEntryId}:to_native`]);
          expect(yield* roundTotal).toEqual([{ total: 2 }]);

          yield* sql`
            update cards set introduced_at = ${fixtureNow}
            where entry_id = ${firstReviewEntryId} and direction = 'to_target'
          `;
          expect(yield* store.loadExamRound(roundId)).toHaveLength(2);
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
