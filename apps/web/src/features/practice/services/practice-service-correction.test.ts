import { describe, expect, it } from 'bun:test';
import type { cards } from '@wordhold/db/schema/practice';
import { Effect, Layer } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import type {
  PersistReviewInput,
  SubmissionRecord,
} from '../schemas/practice-models';
import type { WrongAnswerResolution } from '../schemas/submission-schema';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';
import { PracticeService } from './practice-service';
import { persistedReview } from './practice-service-test-support';
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
  entry: { id: card.entryId, targetText: 'correct', nativeText: 'richtig' },
  targetLanguage: 'en',
};

const rejectedTypo = {
  correct: false,
  acceptAsAlternative: false,
  meaning: { ok: true, note: null },
  grammar: { ok: true, note: null },
  idiomaticity: { ok: true, note: null },
  spelling: { ok: false, note: 'Tippfehler' },
  intendedConstruction: { ok: true, note: null },
  explanation: 'Tippfehler.',
} as const;

const assessmentId = '00000000-0000-0000-0000-000000000003';
const runSubmit = (
  commit: PracticeReviewStore['Type']['commit'],
  wrongAnswerResolution: WrongAnswerResolution,
  acceptedText = 'correct',
) => {
  const cachedAssessment = {
    assessmentId,
    verdict: rejectedTypo,
    model: 'bedrock-mantle:test-model',
  };
  const stores = Layer.mergeAll(
    Layer.succeed(PracticeSessionStore, {
      loadScheduled: () =>
        Effect.succeed({
          items: [],
          availability: {
            due: 0,
            firstReviews: 0,
            ready: 0,
            nextDueAt: null,
          },
        }),
      loadSelection: () => Effect.succeed([]),
    }),
    Layer.succeed(JudgeCacheStore, {
      read: (_key, selector) =>
        Effect.succeed(
          ('assessmentId' in selector &&
            selector.assessmentId === assessmentId) ||
            ('model' in selector && selector.model === cachedAssessment.model)
            ? cachedAssessment
            : undefined,
        ),
      write: () => Effect.void,
      withCriticalSection: (_key, effect) => effect,
    }),
    Layer.succeed(PracticeReviewStore, {
      findSubmission: () => Effect.succeed(submission),
      listAcceptedAnswers: () =>
        Effect.succeed([
          {
            text: acceptedText,
            source: 'textbook',
          },
        ]),
      commit,
    }),
    Layer.succeed(PracticeJudge, {
      model: 'bedrock-mantle:test-model',
      judge: () =>
        Effect.succeed({
          verdict: rejectedTypo,
          model: 'bedrock-mantle:test-model',
        }),
    }),
  );
  const data =
    wrongAnswerResolution === 'defer'
      ? {
          cardId: card.id,
          revision: 0,
          answer: 'corect',
          wrongAnswerResolution,
          mode: 'scheduled' as const,
        }
      : {
          cardId: card.id,
          revision: 0,
          answer: 'corect',
          wrongAnswerResolution,
          assessmentId,
          mode: 'scheduled' as const,
        };
  return Effect.runPromise(
    Effect.flatMap(PracticeService, (service) => service.submit(data)).pipe(
      Effect.provide(PracticeService.Default.pipe(Layer.provide(stores))),
    ),
  );
};

describe('PracticeService learner correction', () => {
  it('keeps a rejected answer pending until the learner chooses a rating', async () => {
    let commits = 0;
    const result = await runSubmit(
      () =>
        Effect.sync(() => {
          commits += 1;
          return persistedReview;
        }),
      'defer',
    );
    expect(result).toMatchObject({
      graded: true,
      correct: false,
      stored: false,
      assessmentId,
    });
    expect(commits).toBe(0);

    const confirmed = await runSubmit(
      () =>
        Effect.sync(() => {
          commits += 1;
          return persistedReview;
        }),
      'again',
    );
    expect(confirmed).toMatchObject({
      graded: true,
      correct: false,
      stored: true,
      rating: ratings.again,
    });
    expect(commits).toBe(1);
  });

  it('stores the original rejected assessment as Hard when accepted answers change', async () => {
    let committed: PersistReviewInput | undefined;
    const result = await runSubmit(
      (input) =>
        Effect.sync(() => {
          committed = input;
          return persistedReview;
        }),
      'hard',
      'corect',
    );
    expect(result).toMatchObject({
      graded: true,
      correct: true,
      stored: true,
      rating: ratings.hard,
      acceptedAsAlternative: false,
    });
    expect(committed).toMatchObject({
      rating: ratings.hard,
      answer: 'corect',
      outcome: { method: 'learner-correction' },
    });
    expect(committed?.outcome).toEqual({
      method: 'learner-correction',
      assessed: { method: 'judge', verdict: rejectedTypo },
    });
  });
});
