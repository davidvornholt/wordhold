import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import type { cards } from '@wordhold/db/schema/practice';
import { Effect, Layer } from 'effect';
import { PracticeJudgeError } from '../errors/practice-errors';
import type { SubmissionRecord } from '../schemas/practice-models';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import { DefinitionGrader } from './definition-grader';
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
    relatedWords: [],
    keyPoints: null,
  },
  targetLanguage: 'en',
  courseKind: 'language',
};

export const persistedReview = {
  revision: 1,
  schedule: {
    advanced: true,
    state: 'learning' as const,
    dueAt: new Date('2026-08-01T09:01:00Z'),
  },
  entryKnown: false,
};

export const unavailableJudge = (cause: string) =>
  Effect.fail(new PracticeJudgeError({ cause, message: 'judge unavailable' }));

export const testGrader = (
  grader: Partial<Omit<DefinitionGrader['Service'], 'model'>> = {},
): DefinitionGrader['Service'] => ({
  model: 'vertex:test-model',
  judge: () => unavailableJudge('definition judge must not run'),
  keyPoints: () => unavailableJudge('key points must not be derived'),
  ...grader,
});

export const testJudge = (
  judge: PracticeJudge['Service']['judge'],
): PracticeJudge['Service'] => ({
  model: 'vertex:test-model',
  judge,
});

const emptySessions: PracticeSessionStore['Service'] = {
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
};

const emptyCache: JudgeCacheStore['Service'] = {
  read: () => Effect.succeed(undefined),
  write: () => Effect.void,
  withCriticalSection: (_key, effect) => effect,
};

type SubmitDependencies = {
  readonly grader?: DefinitionGrader['Service'];
  readonly cache?: JudgeCacheStore['Service'];
};

type ServiceDependencies = Required<SubmitDependencies> & {
  readonly sessions: PracticeSessionStore['Service'];
  readonly reviewStore: PracticeReviewStore['Service'];
  readonly judge: PracticeJudge['Service'];
};

const practiceLayer = ({
  sessions,
  reviewStore,
  judge,
  grader,
  cache,
}: ServiceDependencies) =>
  PracticeService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(PracticeSessionStore, sessions),
        Layer.succeed(JudgeCacheStore, cache),
        Layer.succeed(PracticeReviewStore, reviewStore),
        Layer.succeed(PracticeJudge, judge),
        Layer.succeed(DefinitionGrader, grader),
      ),
    ),
  );

const unusedReviews: PracticeReviewStore['Service'] = {
  findSubmission: () => Effect.die('submissions must not be read'),
  listAcceptedAnswers: () => Effect.die('accepted answers must not be read'),
  listCourseEntries: () => Effect.die('course entries must not be listed'),
  saveKeyPoints: () => Effect.die('key points must not be saved'),
  commit: () => Effect.die('reviews must not be committed'),
};

// Loads a sitting from the given session store; nothing may be graded.
export const runSessionLoad = <A, E>(
  sessions: PracticeSessionStore['Service'],
  load: (service: PracticeService['Service']) => Effect.Effect<A, E>,
) =>
  Effect.flatMap(PracticeService, load).pipe(
    Effect.provide(
      practiceLayer({
        sessions,
        reviewStore: unusedReviews,
        judge: testJudge(() => unavailableJudge('the judge must not run')),
        grader: testGrader(),
        cache: emptyCache,
      }),
    ),
  );

export const runSubmitPayload = (
  reviewStore: PracticeReviewStore['Service'],
  judge: PracticeJudge['Service'],
  payload: SubmitPayloadData,
  { grader = testGrader(), cache = emptyCache }: SubmitDependencies = {},
) =>
  Effect.runPromise(
    Effect.flatMap(PracticeService, (service) => service.submit(payload)).pipe(
      Effect.provide(
        practiceLayer({
          sessions: emptySessions,
          reviewStore,
          judge,
          grader,
          cache,
        }),
      ),
      Effect.result,
      Effect.provide(untrackedAiUsage),
    ),
  );

export const runSubmit = (
  reviewStore: PracticeReviewStore['Service'],
  judge: PracticeJudge['Service'],
  answer = 'wrong',
) =>
  runSubmitPayload(reviewStore, judge, {
    cardId: testCard.id,
    revision: testCard.revision,
    answer,
    dictated: false,
    wrongAnswerResolution: 'defer',
    mode: 'scheduled',
  });
