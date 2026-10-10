import type { AiUsage } from '@wordhold/ai/usage';
import { Clock, Context, Effect, Layer } from 'effect';
import { cardPrompt } from '../../../shared/practice/card-texts';
import type {
  AnswerTooLongError,
  PracticeDatabaseError,
  StaleAnswerSubmissionError,
} from '../errors/practice-errors';
import type {
  PracticeItem,
  PracticeSession,
  SubmitResult,
} from '../schemas/practice-models';
import type {
  SessionRequestData,
  StudyRequestData,
} from '../schemas/session-request';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import { resolveAnswerSubmission } from './answer-submission';
import { DefinitionGrader } from './definition-grader';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';
import { PracticeReviewStore } from './review-store';
import { PracticeSessionStore } from './session-store';

const withPrompt = (
  item: Omit<PracticeItem, 'example' | 'prompt'>,
): PracticeItem => ({
  ...item,
  example: null,
  prompt: cardPrompt(item),
});

export class PracticeService extends Context.Service<
  PracticeService,
  {
    readonly getSession: (input: SessionRequestData) => Effect.Effect<
      {
        items: Array<PracticeItem>;
        available: {
          readonly due: number;
          readonly firstReviews: number;
          readonly ready: number;
          readonly nextDueAt: Date | null;
        };
      },
      PracticeDatabaseError
    >;
    readonly getStudySession: (
      data: StudyRequestData,
    ) => Effect.Effect<PracticeSession, PracticeDatabaseError>;
    readonly submit: (
      data: SubmitPayloadData,
    ) => Effect.Effect<
      SubmitResult,
      PracticeDatabaseError | StaleAnswerSubmissionError | AnswerTooLongError,
      AiUsage
    >;
  }
>()('wordhold/PracticeService') {
  static readonly layer = Layer.effect(
    PracticeService,
    Effect.gen(function* () {
      const sessions = yield* PracticeSessionStore;
      const reviews = yield* PracticeReviewStore;
      const cache = yield* JudgeCacheStore;
      const judge = yield* PracticeJudge;
      const grader = yield* DefinitionGrader;
      const getSession = ({ courseId, direction, place }: SessionRequestData) =>
        Effect.gen(function* () {
          const now = new Date(yield* Clock.currentTimeMillis);
          const { items, availability } = yield* sessions.loadScheduled(
            courseId,
            direction,
            place ?? null,
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
        resolveAnswerSubmission(data, { reviews, cache, judge, grader });
      return PracticeService.of({ getSession, getStudySession, submit });
    }),
  );
}
