import { describe, expect, it } from 'bun:test';
import type { cards } from '@wordhold/db/schema/practice';
import { Effect, Layer } from 'effect';
import {
  PracticeDatabaseError,
  PracticeJudgeError,
} from '../errors/practice-errors';
import type { SubmissionRecord } from '../schemas/practice-models';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';
import { PracticeService } from './practice-service';
import { PracticeReviewStore } from './review-store';
import { PracticeSessionStore } from './session-store';

const card: typeof cards.$inferSelect = {
  id: '00000000-0000-0000-0000-000000000001',
  entryId: '00000000-0000-0000-0000-000000000002',
  direction: 'to_target',
  introducedAt: new Date('2026-08-01T09:00:00Z'),
  state: 'new',
  dueAt: null,
  stability: null,
  difficulty: null,
  reps: 0,
  lapses: 0,
  scheduledDays: 0,
  learningSteps: 0,
  lastReviewedAt: null,
  revision: 0,
};

const submission: SubmissionRecord = {
  card,
  entry: {
    id: card.entryId,
    targetText: 'correct',
    nativeText: 'richtig',
  },
  targetLanguage: 'en',
};

const sessionStore = Layer.succeed(PracticeSessionStore, {
  load: () => Effect.succeed({ due: [], fresh: [] }),
  loadUnit: () => Effect.succeed([]),
});
const cacheStore = Layer.succeed(JudgeCacheStore, {
  read: () => Effect.succeed(undefined),
  write: () => Effect.void,
  withCriticalSection: (_key, effect) => effect,
});

const unavailableJudge = (cause: string) =>
  Effect.fail(
    new PracticeJudgeError({
      cause,
      message: 'judge unavailable',
    }),
  );

const testJudge = (
  judge: PracticeJudge['Type']['judge'],
): PracticeJudge['Type'] => ({
  model: 'bedrock-mantle:test-model',
  judge,
});

const runSubmit = (
  reviewStore: PracticeReviewStore['Type'],
  judge: PracticeJudge['Type'],
  answer = 'wrong',
) =>
  Effect.runPromise(
    Effect.flatMap(PracticeService, (service) =>
      service.submit({
        cardId: card.id,
        revision: card.revision,
        answer,
        mode: 'scheduled',
      }),
    ).pipe(
      Effect.provide(
        PracticeService.Default.pipe(
          Layer.provide(
            Layer.mergeAll(
              sessionStore,
              cacheStore,
              Layer.succeed(PracticeReviewStore, reviewStore),
              Layer.succeed(PracticeJudge, judge),
            ),
          ),
        ),
      ),
      Effect.either,
    ),
  );

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
        commit: () => Effect.succeed(1),
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
        findSubmission: () => Effect.succeed(submission),
        listAcceptedAnswers: () =>
          Effect.succeed([
            {
              text: 'bon/onne',
              normalized: 'bon/onne',
              source: 'textbook',
            },
          ]),
        commit: () => Effect.succeed(1),
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
        findSubmission: () => Effect.succeed(submission),
        listAcceptedAnswers: () =>
          Effect.succeed([
            {
              text: 'profesor/a',
              normalized: 'profesor/a',
              source: 'textbook',
            },
          ]),
        commit: () => Effect.succeed(1),
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
        findSubmission: () => Effect.succeed(submission),
        listAcceptedAnswers: () =>
          Effect.succeed([
            { text: 'correct', normalized: 'correct', source: 'textbook' },
          ]),
        commit: () =>
          Effect.sync(() => {
            commits += 1;
            return commits;
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
