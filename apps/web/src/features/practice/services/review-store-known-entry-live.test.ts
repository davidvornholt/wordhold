import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import {
  dueEntryId,
  fixtureCourseId,
} from '../../../shared/testing/introduced-card-fixture';
import { PracticeReviewStore } from './review-store';
import {
  makeReviewInput,
  runReviewTest,
} from './review-store-live-test-support';

// The fixture's due entry has both directions in review, and its to_target
// card is due.
const answerDueCard = (correct: boolean) =>
  Effect.gen(function* () {
    const store = yield* PracticeReviewStore;
    const input = yield* makeReviewInput({
      entryId: dueEntryId,
      direction: 'to_target',
      answer: 'mémoire',
      correct,
    });
    return yield* store.commit(input);
  });

describe('PracticeReviewStore known-entry contract', () => {
  it('reports the entry as sicher while every direction stays in review', async () => {
    const committed = await runReviewTest(answerDueCard(true));
    expect(committed).toMatchObject({
      schedule: { state: 'review' },
      entryKnown: true,
    });
  });

  it('reports the entry as no longer sicher after a miss', async () => {
    const committed = await runReviewTest(answerDueCard(false));
    expect(committed).toMatchObject({
      schedule: { state: 'relearning' },
      entryKnown: false,
    });
  });

  it('waits for another enabled direction that is still learning', async () => {
    const committed = await runReviewTest(
      Effect.gen(function* () {
        const sql = yield* Database;
        yield* sql`
          update cards set state = 'learning'
          where entry_id = ${dueEntryId} and direction = 'to_native'
        `;
        return yield* answerDueCard(true);
      }),
    );
    expect(committed).toMatchObject({
      schedule: { state: 'review' },
      entryKnown: false,
    });
  });

  it('ignores a direction the course no longer practises', async () => {
    const committed = await runReviewTest(
      Effect.gen(function* () {
        const sql = yield* Database;
        yield* sql`
          update cards set state = 'learning'
          where entry_id = ${dueEntryId} and direction = 'to_native'
        `;
        yield* sql`
          update courses set directions = '{to_target}'::answer_direction[]
          where id = ${fixtureCourseId}
        `;
        return yield* answerDueCard(true);
      }),
    );
    expect(committed).toMatchObject({ entryKnown: true });
  });
});
