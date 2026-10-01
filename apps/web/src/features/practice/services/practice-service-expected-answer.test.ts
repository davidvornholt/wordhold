import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import {
  persistedReview,
  runSubmit,
  testCard,
  testJudge,
  testSubmission,
  unavailableJudge,
} from './practice-service-test-support';

describe('PracticeService expected answer', () => {
  it('reports the textbook answer for a learned alternative', async () => {
    const result = await runSubmit(
      {
        findSubmission: () =>
          Effect.succeed({
            ...testSubmission,
            card: { ...testCard, direction: 'to_native' },
          }),
        saveKeyPoints: (_entryId, _definition, points) =>
          Effect.succeed(points),
        listAcceptedAnswers: () =>
          Effect.succeed([
            { text: 'korrekt', source: 'judge' },
            { text: 'richtig', source: 'textbook' },
          ]),
        commit: () => Effect.succeed(persistedReview),
      },
      testJudge(() => unavailableJudge('judge must not run')),
      'korrekt',
    );
    expect(result).toMatchObject({
      _tag: 'Right',
      right: { graded: true, correct: true, expectedAnswer: 'richtig' },
    });
  });
});
