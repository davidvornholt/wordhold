import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import {
  PracticeDatabaseError,
  PracticeJudgeError,
} from '../errors/practice-errors';
import {
  persistedReview,
  runSubmit,
  testJudge,
  testSubmission,
  unavailableJudge,
} from './practice-service-test-support';

describe('PracticeService', () => {
  it('retains a database failure before grading', async () => {
    const failure = new PracticeDatabaseError({
      operation: 'find submitted card',
      cause: 'offline',
      message: 'database unavailable',
    });
    const result = await runSubmit(
      {
        findSubmission: () => Effect.fail(failure),
        listAcceptedAnswers: () => Effect.succeed([]),
        commit: () => Effect.succeed(persistedReview),
      },
      testJudge(() => unavailableJudge('unused')),
    );
    const receivedFailure = result._tag === 'Left' ? result.left : undefined;
    expect(receivedFailure).toBe(failure);
  });

  it('sends an ambiguous compact suffix fragment to the judge', async () => {
    let judgeCalls = 0;
    const result = await runSubmit(
      {
        findSubmission: () => Effect.succeed(testSubmission),
        listAcceptedAnswers: () =>
          Effect.succeed([
            {
              text: 'bon/onne',
              normalized: 'bon/onne',
              source: 'textbook',
            },
          ]),
        commit: () => Effect.succeed(persistedReview),
      },
      testJudge(() => {
        judgeCalls += 1;
        return unavailableJudge('test rejection');
      }),
      'onne',
    );
    expect(result).toMatchObject({ _tag: 'Right', right: { graded: false } });
    expect(judgeCalls).toBe(1);
  });

  it('accepts a reconstructed suffix reading without asking the judge', async () => {
    let judgeCalls = 0;
    const result = await runSubmit(
      {
        findSubmission: () => Effect.succeed(testSubmission),
        listAcceptedAnswers: () =>
          Effect.succeed([
            {
              text: 'profesor/a',
              normalized: 'profesor/a',
              source: 'textbook',
            },
          ]),
        commit: () => Effect.succeed(persistedReview),
      },
      testJudge(() =>
        Effect.sync(() => {
          judgeCalls += 1;
        }).pipe(
          Effect.flatMap(() =>
            Effect.fail(
              new PracticeJudgeError({
                cause: 'unexpected',
                message: 'judge must not run',
              }),
            ),
          ),
        ),
      ),
      'profesora',
    );
    const value = result._tag === 'Right' ? result.right : undefined;
    expect(value).toMatchObject({ graded: true, correct: true });
    expect(judgeCalls).toBe(0);
  });

  it('leaves the card untouched when the typed provider fails', async () => {
    let commits = 0;
    const result = await runSubmit(
      {
        findSubmission: () => Effect.succeed(testSubmission),
        listAcceptedAnswers: () =>
          Effect.succeed([
            { text: 'correct', normalized: 'correct', source: 'textbook' },
          ]),
        commit: () =>
          Effect.sync(() => {
            commits += 1;
            return persistedReview;
          }),
      },
      testJudge(() => unavailableJudge('offline')),
    );
    expect(result._tag).toBe('Right');
    const value = result._tag === 'Right' ? result.right : undefined;
    expect(value).toMatchObject({ graded: false });
    expect(commits).toBe(0);
  });
});
