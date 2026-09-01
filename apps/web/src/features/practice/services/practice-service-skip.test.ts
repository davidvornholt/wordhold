import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import type { PersistReviewInput } from '../schemas/practice-models';
import {
  persistedReview,
  runSubmitPayload,
  testCard,
  testJudge,
  testSubmission,
  unavailableJudge,
} from './practice-service-test-support';

describe('PracticeService skip', () => {
  it('commits a skipped card as a lapse without consulting the judge', async () => {
    let judgeCalls = 0;
    const commits: Array<PersistReviewInput> = [];
    const result = await runSubmitPayload(
      {
        findSubmission: () => Effect.succeed(testSubmission),
        listAcceptedAnswers: () =>
          Effect.succeed([{ text: 'correct', source: 'textbook' }]),
        commit: (input) =>
          Effect.sync(() => {
            commits.push(input);
            return persistedReview;
          }),
      },
      testJudge(() =>
        Effect.sync(() => {
          judgeCalls += 1;
        }).pipe(Effect.flatMap(() => unavailableJudge('judge must not run'))),
      ),
      {
        cardId: testCard.id,
        revision: testCard.revision,
        skipped: true,
        mode: 'scheduled',
      },
    );
    expect(judgeCalls).toBe(0);
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({
      rating: ratings.again,
      answer: '',
      outcome: { method: 'skip' },
    });
    expect(result).toMatchObject({
      _tag: 'Right',
      right: {
        graded: true,
        correct: false,
        stored: true,
        expectedAnswers: ['correct'],
      },
    });
  });
});
