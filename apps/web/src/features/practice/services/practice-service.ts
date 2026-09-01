import { Clock, Effect } from 'effect';
import type { PracticeItem, PracticeSession } from '../schemas/practice-models';
import type {
  SessionRequestData,
  StudyRequestData,
} from '../schemas/session-request';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import { resolveAnswerSubmission } from './answer-submission';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';
import { PracticeReviewStore } from './review-store';
import { PracticeSessionStore } from './session-store';

const withPrompt = (
  item: Omit<PracticeItem, 'example' | 'prompt'>,
): PracticeItem => ({
  ...item,
  example: null,
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
      const getSession = ({
        courseId,
        direction,
        unitId,
      }: SessionRequestData) =>
        Effect.gen(function* () {
          const now = new Date(yield* Clock.currentTimeMillis);
          const { items, availability } = yield* sessions.loadScheduled(
            courseId,
            direction,
            unitId ?? null,
            now,
          );
          return {
            items: items.map(withPrompt),
            available: availability,
          } satisfies PracticeSession;
        });
      const getStudySession = (data: StudyRequestData) =>
        Effect.map(
          sessions.loadSelection(data),
          (items): PracticeSession => ({
            items: items.map(withPrompt),
            available: {
              due: 0,
              firstReviews: items.length,
              ready: items.length,
              nextDueAt: null,
            },
          }),
        );
      const submit = (data: SubmitPayloadData) =>
        resolveAnswerSubmission(data, { reviews, cache, judge });
      return { getSession, getStudySession, submit } as const;
    }),
  },
) {}
