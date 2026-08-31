import type { cards } from '@wordhold/db/schema/practice';
import { Effect, Layer } from 'effect';
import { PracticeJudgeError } from '../errors/practice-errors';
import type { SubmissionRecord } from '../schemas/practice-models';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';
import { PracticeService } from './practice-service';
import { PracticeReviewStore } from './review-store';
import { PracticeSessionStore } from './session-store';

export const testCard: typeof cards.$inferSelect = {
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

export const testSubmission: SubmissionRecord = {
  card: testCard,
  entry: {
    id: testCard.entryId,
    targetText: 'correct',
    nativeText: 'richtig',
  },
  targetLanguage: 'en',
};

export const persistedReview = {
  revision: 1,
  schedule: {
    advanced: true,
    state: 'learning' as const,
    dueAt: new Date('2026-08-01T09:01:00Z'),
  },
};

export const unavailableJudge = (cause: string) =>
  Effect.fail(new PracticeJudgeError({ cause, message: 'judge unavailable' }));

export const testJudge = (
  judge: PracticeJudge['Type']['judge'],
): PracticeJudge['Type'] => ({
  model: 'bedrock-mantle:test-model',
  judge,
});

const sessionStore = Layer.succeed(PracticeSessionStore, {
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
});

const cacheStore = Layer.succeed(JudgeCacheStore, {
  read: () => Effect.succeed(undefined),
  write: () => Effect.void,
  withCriticalSection: (_key, effect) => effect,
});

export const runSubmitPayload = (
  reviewStore: PracticeReviewStore['Type'],
  judge: PracticeJudge['Type'],
  payload: SubmitPayloadData,
) =>
  Effect.runPromise(
    Effect.flatMap(PracticeService, (service) => service.submit(payload)).pipe(
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

export const runSubmit = (
  reviewStore: PracticeReviewStore['Type'],
  judge: PracticeJudge['Type'],
  answer = 'wrong',
) =>
  runSubmitPayload(reviewStore, judge, {
    cardId: testCard.id,
    revision: testCard.revision,
    answer,
    wrongAnswerResolution: 'defer',
    mode: 'scheduled',
  });
