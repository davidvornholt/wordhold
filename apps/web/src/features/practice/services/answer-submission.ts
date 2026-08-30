import { isAcceptedAlternative } from '@wordhold/ai/judge/schema';
import { Clock, Effect } from 'effect';
import { normalizeAnswer } from '../../../shared/grading/normalize';
import {
  deriveRating,
  type GradeOutcome,
  isCorrect,
} from '../../../shared/grading/rating';
import { StaleAnswerSubmissionError } from '../errors/practice-errors';
import type {
  SubmissionRecord,
  SubmitResult,
} from '../schemas/practice-models';
import type {
  AnsweredSubmitData,
  SubmitPayloadData,
} from '../schemas/submission-schema';
import {
  type AssessedAnswer,
  gradeAnswer,
  loadRejectedAssessment,
} from './answer-assessment';
import type { JudgeCacheStore } from './judge-cache-store';
import type { PracticeJudge } from './practice-judge';
import type { PracticeReviewStore } from './review-store';

type SubmissionDependencies = {
  readonly reviews: PracticeReviewStore['Type'];
  readonly cache: JudgeCacheStore['Type'];
  readonly judge: PracticeJudge['Type'];
};

const pendingRejectedResult = (
  assessed: AssessedAnswer,
  data: AnsweredSubmitData,
  expectedAnswers: ReadonlyArray<string>,
): SubmitResult | null => {
  if (isCorrect(assessed.outcome) || data.wrongAnswerResolution !== 'defer') {
    return null;
  }
  if (assessed.assessmentId === null || assessed.outcome.method !== 'judge') {
    return null;
  }
  return {
    graded: true,
    correct: false,
    stored: false,
    expectedAnswers,
    explanation: assessed.outcome.verdict.explanation,
    acceptedAsAlternative: false,
    assessmentId: assessed.assessmentId,
  };
};

type CommitOutcomeInput = {
  readonly reviews: PracticeReviewStore['Type'];
  readonly row: SubmissionRecord;
  readonly data: SubmitPayloadData;
  readonly outcome: GradeOutcome;
  readonly answer: string;
  readonly normalizedAnswer: string;
  readonly expectedAnswers: ReadonlyArray<string>;
};

const commitOutcome = ({
  reviews,
  row,
  data,
  outcome,
  answer,
  normalizedAnswer,
  expectedAnswers,
}: CommitOutcomeInput) =>
  Effect.gen(function* () {
    const elapsedMs = data.elapsedMs ?? null;
    const rating = deriveRating(outcome, elapsedMs);
    const reviewedAt = new Date(yield* Clock.currentTimeMillis);
    const persisted = yield* reviews.commit({
      card: row.card,
      expectedRevision: data.revision,
      rating,
      reviewedAt,
      outcome,
      answer,
      elapsedMs,
      entryId: row.entry.id,
      direction: row.card.direction,
      normalizedAnswer,
      mode: data.mode,
    });
    const assessed =
      outcome.method === 'learner-correction' ? outcome.assessed : outcome;
    return {
      graded: true as const,
      correct: isCorrect(outcome),
      stored: true as const,
      revision: persisted.revision,
      rating,
      expectedAnswers,
      explanation:
        assessed.method === 'judge' ? assessed.verdict.explanation : null,
      acceptedAsAlternative:
        assessed.method === 'judge' && isAcceptedAlternative(assessed.verdict),
      schedule: persisted.schedule,
    };
  });

export const resolveAnswerSubmission = (
  data: SubmitPayloadData,
  { reviews, cache, judge }: SubmissionDependencies,
) =>
  Effect.gen(function* () {
    const row = yield* reviews.findSubmission(data.cardId, data.revision);
    if (row === undefined) {
      return yield* new StaleAnswerSubmissionError({
        message: 'Diese Karte wurde bereits beantwortet. Lade die Übung neu.',
      });
    }
    const accepted = yield* reviews.listAcceptedAnswers(
      row.entry.id,
      row.card.direction,
    );
    const expectedAnswers = accepted.map((answer) => answer.text);
    if ('skipped' in data) {
      // A skip is never graded: it reveals the solution and commits a lapse
      // without consulting the matcher or the judge.
      return yield* commitOutcome({
        reviews,
        row,
        data,
        outcome: { method: 'skip' },
        answer: '',
        normalizedAnswer: '',
        expectedAnswers,
      });
    }
    const normalized = normalizeAnswer(data.answer);
    const assessment = yield* data.wrongAnswerResolution === 'defer'
      ? gradeAnswer({ row, accepted, data, normalized, cache, judge })
      : loadRejectedAssessment({
          row,
          normalized,
          assessmentId: data.assessmentId,
          cache,
        });
    if (assessment === null) {
      return {
        graded: false as const,
        expectedAnswers,
        message:
          'Der KI-Prüfer ist gerade nicht erreichbar; die Antwort wurde nicht gewertet.',
      };
    }
    const pending = pendingRejectedResult(assessment, data, expectedAnswers);
    if (pending !== null) {
      return pending;
    }
    const assessed = assessment.outcome;
    const outcome: GradeOutcome =
      !isCorrect(assessed) && data.wrongAnswerResolution === 'hard'
        ? { method: 'learner-correction', assessed }
        : assessed;
    return yield* commitOutcome({
      reviews,
      row,
      data,
      outcome,
      answer: data.answer,
      normalizedAnswer: normalized,
      expectedAnswers,
    });
  });
