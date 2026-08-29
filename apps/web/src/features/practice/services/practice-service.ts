import { Clock, Effect } from 'effect';
import type { PracticeItem } from '../schemas/practice-models';
import type {
  DrillRequestData,
  SessionRequestData,
} from '../schemas/session-request';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import { resolveAnswerSubmission } from './answer-submission';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';
import { PracticeReviewStore } from './review-store';
import { PracticeSessionStore } from './session-store';

export type PracticeSession = {
  readonly items: ReadonlyArray<PracticeItem>;
};

export type { ResolvedSubmitResult, SubmitResult } from './answer-submission';

// The side of the card the learner sees. Stored rows carry both texts; which
// one is the question depends on the direction the card is asked in.
const withPrompt = (item: Omit<PracticeItem, 'prompt'>): PracticeItem => ({
  ...item,
  prompt: item.direction === 'to_target' ? item.nativeText : item.targetText,
});

export class PracticeService extends Effect.Service<PracticeService>()(
  'wordhold/PracticeService',
  {
    effect: Effect.gen(function* () {
      const sessions = yield* PracticeSessionStore;
      const reviews = yield* PracticeReviewStore;
      const cache = yield* JudgeCacheStore;
      const judge = yield* PracticeJudge;
      const getSession = ({ courseId, direction }: SessionRequestData) =>
        Effect.gen(function* () {
          const now = new Date(yield* Clock.currentTimeMillis);
          const { due, fresh } = yield* sessions.load(courseId, direction, now);
          return {
            items: [...due, ...fresh].map(withPrompt),
          } satisfies PracticeSession;
        });
      const getDrill = ({ unitId, direction }: DrillRequestData) =>
        Effect.map(
          sessions.loadUnit(unitId, direction),
          (items): PracticeSession => ({ items: items.map(withPrompt) }),
        );
      const submit = (data: SubmitPayloadData) =>
        resolveAnswerSubmission(data, { reviews, cache, judge });
      return { getSession, getDrill, submit } as const;
    }),
  },
) {}
