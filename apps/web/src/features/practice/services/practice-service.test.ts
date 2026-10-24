import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import {
  PracticeDatabaseError,
  PracticeJudgeError,
} from '../errors/practice-errors';
import type { PersistReviewInput } from '../schemas/practice-models';
import {
  persistedReview,
  runSubmit,
  testJudge,
  testSubmission,
  unavailableJudge,
} from './practice-service-test-support';

const acceptedAlternative = {
  correct: true,
  acceptAsAlternative: true,
  otherWording: false,
  meaning: { ok: true, note: null },
  grammar: { ok: true, note: null },
  idiomaticity: { ok: true, note: null },
  spelling: { ok: true, note: null },
  intendedConstruction: { ok: true, note: null },
  explanation: 'Passt.',
} as const;

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
        listCourseEntries: () =>
          Effect.die('course entries must not be listed'),
        saveKeyPoints: (_entryId, _definition, points) =>
          Effect.succeed(points),
        listAcceptedAnswers: () => Effect.succeed([]),
        commit: () => Effect.succeed(persistedReview),
      },
      testJudge(() => unavailableJudge('unused')),
    );
    const receivedFailure =
      result._tag === 'Failure' ? result.failure : undefined;
    expect(receivedFailure).toBe(failure);
  });

  it('sends an ambiguous compact suffix fragment to the judge', async () => {
    let judgeCalls = 0;
    const result = await runSubmit(
      {
        findSubmission: () => Effect.succeed(testSubmission),
        listCourseEntries: () =>
          Effect.die('course entries must not be listed'),
        saveKeyPoints: (_entryId, _definition, points) =>
          Effect.succeed(points),
        listAcceptedAnswers: () =>
          Effect.succeed([
            {
              text: 'bon/onne',
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
    expect(result).toMatchObject({
      _tag: 'Success',
      success: { graded: false },
    });
    expect(judgeCalls).toBe(1);
  });

  it('accepts a reconstructed suffix reading without asking the judge', async () => {
    let judgeCalls = 0;
    const result = await runSubmit(
      {
        findSubmission: () => Effect.succeed(testSubmission),
        listCourseEntries: () =>
          Effect.die('course entries must not be listed'),
        saveKeyPoints: (_entryId, _definition, points) =>
          Effect.succeed(points),
        listAcceptedAnswers: () =>
          Effect.succeed([
            {
              text: 'profesor/a',
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
    const value = result._tag === 'Success' ? result.success : undefined;
    expect(value).toMatchObject({ graded: true, correct: true });
    expect(judgeCalls).toBe(0);
  });

  it('leaves the card untouched when the typed provider fails', async () => {
    let commits = 0;
    const result = await runSubmit(
      {
        findSubmission: () => Effect.succeed(testSubmission),
        listCourseEntries: () =>
          Effect.die('course entries must not be listed'),
        saveKeyPoints: (_entryId, _definition, points) =>
          Effect.succeed(points),
        listAcceptedAnswers: () =>
          Effect.succeed([{ text: 'correct', source: 'textbook' }]),
        commit: () =>
          Effect.sync(() => {
            commits += 1;
            return persistedReview;
          }),
      },
      testJudge(() => unavailableJudge('offline')),
    );
    expect(result._tag).toBe('Success');
    const value = result._tag === 'Success' ? result.success : undefined;
    expect(value).toMatchObject({ graded: false });
    expect(commits).toBe(0);
  });
});

describe('PracticeService judge alternatives', () => {
  it('reports a judge alternative only when the store kept it', async () => {
    const committed: Array<PersistReviewInput> = [];
    const submit = (alternativeStored: boolean) =>
      runSubmit(
        {
          findSubmission: () => Effect.succeed(testSubmission),
          listCourseEntries: () =>
            Effect.die('course entries must not be listed'),
          saveKeyPoints: (_entryId, _definition, points) =>
            Effect.succeed(points),
          listAcceptedAnswers: () =>
            Effect.succeed([{ text: 'correct', source: 'textbook' }]),
          commit: (input) =>
            Effect.sync(() => {
              committed.push(input);
              return { ...persistedReview, alternativeStored };
            }),
        },
        testJudge(() =>
          Effect.succeed({
            verdict: acceptedAlternative,
            model: 'vertex:test-model',
          }),
        ),
        'right',
      );

    const kept = await submit(true);
    const dropped = await submit(false);

    expect(kept).toMatchObject({
      _tag: 'Success',
      success: { correct: true, acceptedAsAlternative: true },
    });
    expect(dropped).toMatchObject({
      _tag: 'Success',
      success: { correct: true, acceptedAsAlternative: false },
    });
    expect(committed.map((input) => input.gradedTexts)).toEqual([
      { targetText: 'correct', nativeText: 'richtig' },
      { targetText: 'correct', nativeText: 'richtig' },
    ]);
  });
});
