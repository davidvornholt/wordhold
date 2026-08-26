import { isAcceptedAlternative } from '@wordhold/ai/judge/schema';
import { Clock, Effect } from 'effect';
import { normalizeAnswer } from '../../../shared/grading/normalize';
import {
  deriveRating,
  type GradeOutcome,
  isCorrect,
} from '../../../shared/grading/rating';
import { englishNames } from '../../../shared/languages';
import { StaleAnswerSubmissionError } from '../errors/practice-errors';
import type {
  PracticeItem,
  SubmissionRecord,
} from '../schemas/practice-models';
import type {
  DrillRequestData,
  SessionRequestData,
} from '../schemas/session-request';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import { judgeWithCache } from './judge-cache';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';
import { PracticeReviewStore } from './review-store';
import { PracticeSessionStore } from './session-store';

export type PracticeSession = {
  readonly items: ReadonlyArray<PracticeItem>;
};

export type SubmitResult =
  | {
      readonly graded: false;
      readonly expectedAnswers: ReadonlyArray<string>;
      readonly message: string;
    }
  | {
      readonly graded: true;
      readonly correct: boolean;
      // The card's revision after this answer. A card that comes back later in
      // the same session is submitted against it.
      readonly revision: number;
      readonly rating: number;
      readonly expectedAnswers: ReadonlyArray<string>;
      readonly explanation: string | null;
      readonly acceptedAsAlternative: boolean;
    };

type GradeAnswerInput = {
  readonly row: SubmissionRecord;
  readonly accepted: ReadonlyArray<{
    readonly text: string;
    readonly normalized: string;
  }>;
  readonly data: SubmitPayloadData;
  readonly normalized: string;
  readonly cache: JudgeCacheStore['Type'];
  readonly judge: PracticeJudge['Type'];
};

// The side of the card the learner sees. Stored rows carry both texts; which
// one is the question depends on the direction the card is asked in.
const withPrompt = (item: Omit<PracticeItem, 'prompt'>): PracticeItem => ({
  ...item,
  prompt: item.direction === 'to_target' ? item.nativeText : item.targetText,
});

const gradeAnswer = ({
  row,
  accepted,
  data,
  normalized,
  cache,
  judge,
}: GradeAnswerInput) => {
  if (accepted.some((answer) => answer.normalized === normalized)) {
    return Effect.succeed<GradeOutcome>({ method: 'exact' });
  }
  const expectedAnswers = accepted.map((answer) => answer.text);
  return judgeWithCache({
    entryId: row.entry.id,
    direction: row.card.direction,
    normalizedAnswer: normalized,
    input: {
      direction: row.card.direction,
      targetLanguage: englishNames[row.targetLanguage],
      prompt:
        row.card.direction === 'to_target'
          ? row.entry.nativeText
          : row.entry.targetText,
      expectedAnswers,
      givenAnswer: data.answer,
      entryType: row.entry.type,
    },
  }).pipe(
    Effect.map((verdict): GradeOutcome => ({ method: 'judge', verdict })),
    Effect.provideService(JudgeCacheStore, cache),
    Effect.provideService(PracticeJudge, judge),
    Effect.catchTag('PracticeJudgeError', () => Effect.succeed(null)),
  );
};

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
        Effect.gen(function* () {
          const row = yield* reviews.findSubmission(data.cardId, data.revision);
          if (row === undefined) {
            return yield* new StaleAnswerSubmissionError({
              message:
                'Diese Karte wurde bereits beantwortet. Lade die Übung neu.',
            });
          }
          const accepted = yield* reviews.listAcceptedAnswers(
            row.entry.id,
            row.card.direction,
          );
          const normalized = normalizeAnswer(data.answer);
          const expectedAnswers = accepted.map((answer) => answer.text);
          const outcome = yield* gradeAnswer({
            row,
            accepted,
            data,
            normalized,
            cache,
            judge,
          });
          if (outcome === null) {
            return {
              graded: false as const,
              expectedAnswers,
              message:
                'Der KI-Prüfer ist gerade nicht erreichbar; die Antwort wurde nicht gewertet.',
            };
          }
          const correct = isCorrect(outcome);
          const elapsedMs = data.elapsedMs ?? null;
          const rating = deriveRating(outcome, elapsedMs);
          const reviewedAt = new Date(yield* Clock.currentTimeMillis);
          const revision = yield* reviews.commit({
            card: row.card,
            expectedRevision: data.revision,
            rating,
            reviewedAt,
            outcome,
            answer: data.answer,
            elapsedMs,
            entryId: row.entry.id,
            direction: row.card.direction,
            normalizedAnswer: normalized,
            mode: data.mode,
          });
          return {
            graded: true as const,
            correct,
            revision,
            rating,
            expectedAnswers,
            explanation:
              outcome.method === 'judge' ? outcome.verdict.explanation : null,
            acceptedAsAlternative:
              outcome.method === 'judge' &&
              isAcceptedAlternative(outcome.verdict),
          };
        });
      return { getSession, getDrill, submit } as const;
    }),
  },
) {}
