import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import {
  dueEntryId,
  freshEntryId,
} from '../../../shared/testing/introduced-card-fixture';
import { StaleAnswerSubmissionError } from '../errors/practice-errors';
import { PracticeReviewStore } from './review-store';
import {
  makeReviewInput,
  runReviewTest,
} from './review-store-live-test-support';

describe('PracticeReviewStore PostgreSQL transaction', () => {
  it('returns the revision written by PostgreSQL', async () => {
    await runReviewTest(
      Effect.gen(function* () {
        const store = yield* PracticeReviewStore;
        const sql = yield* Database;
        const input = yield* makeReviewInput({
          entryId: dueEntryId,
          direction: 'to_target',
          answer: 'souvenir',
        });
        expect(yield* store.commit(input)).toBe(1);
        const rows = yield* sql<{
          readonly revision: number;
          readonly reviews: number;
        }>`
          select c.revision, count(r.id)::integer as reviews
          from cards c
          left join reviews r on r.card_id = c.id
          where c.id = ${input.card.id}
          group by c.id
        `;
        expect(rows.at(0)).toEqual({ revision: 1, reviews: 1 });
      }),
    );
  });

  it('accepts exactly one concurrent submission for a revision', async () => {
    await runReviewTest(
      Effect.gen(function* () {
        const store = yield* PracticeReviewStore;
        const sql = yield* Database;
        const input = yield* makeReviewInput({
          entryId: freshEntryId,
          direction: 'to_target',
          answer: 'ouvrage',
        });
        const results = yield* Effect.all(
          [
            store.commit(input).pipe(Effect.either),
            store.commit(input).pipe(Effect.either),
          ],
          { concurrency: 'unbounded' },
        );
        const accepted = results.filter((result) => result._tag === 'Right');
        const rejected = results.filter((result) => result._tag === 'Left');
        expect(accepted).toHaveLength(1);
        expect(
          accepted.at(0)?._tag === 'Right' ? accepted[0].right : null,
        ).toBe(1);
        expect(rejected).toHaveLength(1);
        expect(
          rejected.at(0)?._tag === 'Left' ? rejected[0].left : null,
        ).toBeInstanceOf(StaleAnswerSubmissionError);
        const rows = yield* sql<{
          readonly revision: number;
          readonly reviews: number;
        }>`
          select c.revision, count(r.id)::integer as reviews
          from cards c
          left join reviews r on r.card_id = c.id
          where c.id = ${input.card.id}
          group by c.id
        `;
        expect(rows.at(0)).toEqual({ revision: 1, reviews: 1 });
      }),
    );
  });

  it('rolls back the card and accepted alternative when review insertion fails', async () => {
    await runReviewTest(
      Effect.gen(function* () {
        const store = yield* PracticeReviewStore;
        const sql = yield* Database;
        yield* sql`
          alter table reviews add constraint test_reject_review
          check (answer_text <> 'force rollback')
        `;
        const input = yield* makeReviewInput({
          entryId: dueEntryId,
          direction: 'to_native',
          answer: 'force rollback',
          mode: 'drill',
        });
        expect((yield* store.commit(input).pipe(Effect.either))._tag).toBe(
          'Left',
        );
        const cards = yield* sql<{ readonly revision: number }>`
          select revision from cards where id = ${input.card.id}
        `;
        const reviews = yield* sql<{ readonly count: number }>`
          select count(*)::integer as count from reviews
          where card_id = ${input.card.id}
        `;
        const alternatives = yield* sql<{ readonly count: number }>`
          select count(*)::integer as count from accepted_answers
          where entry_id = ${input.entryId}
            and direction = ${input.direction}
            and normalized = ${input.normalizedAnswer}
        `;
        expect(cards.at(0)?.revision).toBe(0);
        expect(reviews.at(0)?.count).toBe(0);
        expect(alternatives.at(0)?.count).toBe(0);
      }),
    );
  });
});
