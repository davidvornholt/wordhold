import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { dueEntryId } from '../../../shared/testing/introduced-card-fixture';
import { StaleAnswerSubmissionError } from '../errors/practice-errors';
import { PracticeReviewStore } from './review-store';
import {
  makeReviewInput,
  runReviewTest,
} from './review-store-live-test-support';

type CardScheduleRow = {
  readonly state: string;
  readonly dueAt: Date | null;
  readonly stability: number | null;
  readonly difficulty: number | null;
  readonly reps: number;
  readonly lapses: number;
  readonly scheduledDays: number;
  readonly learningSteps: number;
  readonly lastReviewedAt: Date | null;
  readonly revision: number;
};

const readCardSchedule = (cardId: string) =>
  Effect.flatMap(Database, (sql) =>
    sql<CardScheduleRow>`
      select state, due_at as "dueAt", stability, difficulty, reps, lapses,
        scheduled_days as "scheduledDays", learning_steps as "learningSteps",
        last_reviewed_at as "lastReviewedAt", revision
      from cards where id = ${cardId}
    `.pipe(
      Effect.flatMap((rows) => {
        const row = rows.at(0);
        return row === undefined
          ? Effect.die('Expected the seeded card schedule.')
          : Effect.succeed(row);
      }),
    ),
  );

describe('PracticeReviewStore held schedule', () => {
  it('persists both review modes through the PostgreSQL enum', async () => {
    await runReviewTest(
      Effect.gen(function* () {
        const store = yield* PracticeReviewStore;
        const sql = yield* Database;
        const drill = yield* makeReviewInput({
          entryId: dueEntryId,
          direction: 'to_target',
          answer: 'souvenir',
          mode: 'drill',
        });
        const scheduled = yield* makeReviewInput({
          entryId: dueEntryId,
          direction: 'to_native',
          answer: 'Erinnerung',
        });
        yield* store.commit(drill);
        yield* store.commit(scheduled);

        const labels = yield* sql<{ readonly label: string }>`
          select enumlabel as label
          from pg_enum
          where enumtypid = 'review_mode'::regtype
          order by enumsortorder
        `;
        const reviews = yield* sql<{ readonly mode: string }>`
          select mode::text from reviews order by reviewed_at, card_id
        `;
        const dueAfter = yield* readCardSchedule(drill.card.id);
        expect(labels.map(({ label }) => label)).toEqual([
          'scheduled',
          'drill',
        ]);
        expect(reviews.map(({ mode }) => mode).sort()).toEqual([
          'drill',
          'scheduled',
        ]);
        // A client-reported drill cannot suppress a genuinely due update.
        expect(dueAfter.revision).toBe(1);
        expect(dueAfter.lastReviewedAt).toEqual(drill.reviewedAt);
      }),
    );
  });

  it('increments only the revision for a future review card', async () => {
    await runReviewTest(
      Effect.gen(function* () {
        const store = yield* PracticeReviewStore;
        // Reporting "scheduled" cannot force an early FSRS update. The card
        // state and due date are the server-owned source of truth.
        const input = yield* makeReviewInput({
          entryId: dueEntryId,
          direction: 'to_native',
          answer: 'Erinnerung',
          mode: 'scheduled',
        });
        const before = yield* readCardSchedule(input.card.id);
        expect(yield* store.commit(input)).toBe(1);
        const after = yield* readCardSchedule(input.card.id);
        expect(after).toEqual({ ...before, revision: 1 });
      }),
    );
  });

  it('accepts only one concurrent held submission', async () => {
    await runReviewTest(
      Effect.gen(function* () {
        const store = yield* PracticeReviewStore;
        const sql = yield* Database;
        const input = yield* makeReviewInput({
          entryId: dueEntryId,
          direction: 'to_native',
          answer: 'Erinnerung',
          mode: 'drill',
        });
        const results = yield* Effect.all(
          [
            store.commit(input).pipe(Effect.either),
            store.commit(input).pipe(Effect.either),
          ],
          { concurrency: 'unbounded' },
        );
        expect(results.filter(({ _tag }) => _tag === 'Right')).toHaveLength(1);
        const rejection = results.find(({ _tag }) => _tag === 'Left');
        expect(
          rejection?._tag === 'Left' ? rejection.left : undefined,
        ).toBeInstanceOf(StaleAnswerSubmissionError);
        const rows = yield* sql<{
          readonly revision: number;
          readonly reviews: number;
        }>`
          select c.revision, count(r.id)::integer as reviews
          from cards c left join reviews r on r.card_id = c.id
          where c.id = ${input.card.id}
          group by c.id
        `;
        expect(rows.at(0)).toEqual({ revision: 1, reviews: 1 });
      }),
    );
  });
});
