import { maximumEntryTextLength } from '@wordhold/ai/extraction/schema';
import { isAcceptedAlternative } from '@wordhold/ai/judge/schema';
import { Clock, Effect } from 'effect';
import { normalizeAnswer } from '../../../shared/grading/normalize';
import {
  deriveRating,
  type GradeOutcome,
  isCorrect,
} from '../../../shared/grading/rating';
import {
  AnswerTooLongError,
  StaleAnswerSubmissionError,
} from '../errors/practice-errors';
import type {
  KeyPointFinding,
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
import type { DefinitionGrader } from './definition-grader';
import type { JudgeCacheStore } from './judge-cache-store';
import type { PracticeJudge } from './practice-judge';
import type { PracticeReviewStore } from './review-store';

type SubmissionDependencies = {
  readonly reviews: PracticeReviewStore['Type'];
  readonly cache: JudgeCacheStore['Type'];
  readonly judge: PracticeJudge['Type'];
  readonly grader: DefinitionGrader['Type'];
};

type AssessedOutcome = AssessedAnswer['outcome'];

const explanationOf = (assessed: AssessedOutcome): string | null =>
  assessed.method === 'exact' || assessed.method === 'recitation'
    ? null
    : assessed.verdict.explanation;

// Lines each key point up with the judge's finding for it, so the feedback
// can mark what the definition covered.
const keyPointFindings = (
  assessed: AssessedOutcome,
): ReadonlyArray<KeyPointFinding> | null =>
  assessed.method === 'definition'
    ? assessed.keyPoints.map((text, index) => ({
        text,
        covered: assessed.verdict.keyPoints[index]?.covered ?? false,
        note: assessed.verdict.keyPoints[index]?.note ?? null,
      }))
    : null;

const pendingRejectedResult = (
  assessed: AssessedAnswer,
  data: AnsweredSubmitData,
  expectedAnswer: string,
): SubmitResult | null => {
  if (isCorrect(assessed.outcome) || data.wrongAnswerResolution !== 'defer') {
    return null;
  }
  if (assessed.assessmentId === null) {
    return null;
  }
  return {
    graded: true,
    correct: false,
    stored: false,
    expectedAnswer,
    explanation: assessed.outcome.verdict.explanation,
    acceptedAsAlternative: false,
    keyPoints: keyPointFindings(assessed.outcome),
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
  readonly expectedAnswer: string;
};

const commitOutcome = ({
  reviews,
  row,
  data,
  outcome,
  answer,
  normalizedAnswer,
  expectedAnswer,
}: CommitOutcomeInput) =>
  Effect.gen(function* () {
    const elapsedMs = data.elapsedMs ?? null;
    // How fast a definition or a text was written says little about how well
    // it is known, so even an exact one is never rated easy.
    const rating = deriveRating(
      outcome,
      row.courseKind === 'language' ? elapsedMs : null,
    );
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
      expectedAnswer,
      explanation: assessed.method === 'skip' ? null : explanationOf(assessed),
      acceptedAsAlternative:
        assessed.method === 'judge' && isAcceptedAlternative(assessed.verdict),
      keyPoints: assessed.method === 'skip' ? null : keyPointFindings(assessed),
      schedule: persisted.schedule,
      entryKnown: persisted.entryKnown,
    };
  });

// The submission schema admits a recited text; an answer the judge grades is
// held to the length of an entry.
const checkAnswerLength = (row: SubmissionRecord, answer: string) =>
  row.courseKind !== 'texts' && answer.length > maximumEntryTextLength
    ? Effect.fail(
        new AnswerTooLongError({
          message: `Eine Antwort darf höchstens ${maximumEntryTextLength} Zeichen lang sein.`,
        }),
      )
    : Effect.void;

export const resolveAnswerSubmission = (
  data: SubmitPayloadData,
  { reviews, cache, judge, grader }: SubmissionDependencies,
) =>
  Effect.gen(function* () {
    const row = yield* reviews.findSubmission(
      data.cardId,
      data.revision,
      data.mode,
    );
    if (row === undefined) {
      return yield* new StaleAnswerSubmissionError({
        message: 'Diese Karte wurde bereits beantwortet. Lade die Übung neu.',
      });
    }
    const accepted = yield* reviews.listAcceptedAnswers(
      row.entry.id,
      row.card.direction,
    );
    // The entry's own text for the asked direction: its textbook answer.
    const expectedAnswer =
      row.card.direction === 'to_target'
        ? row.entry.targetText
        : row.entry.nativeText;
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
        expectedAnswer,
      });
    }
    yield* checkAnswerLength(row, data.answer);
    const normalized = normalizeAnswer(data.answer);
    const assessment = yield* data.wrongAnswerResolution === 'defer'
      ? gradeAnswer({
          row,
          accepted,
          data,
          normalized,
          reviews,
          cache,
          judge,
          grader,
        })
      : loadRejectedAssessment({
          row,
          answer: data.answer,
          normalized,
          assessmentId: data.assessmentId,
          cache,
          grader,
        });
    if (assessment === null) {
      return {
        graded: false as const,
        expectedAnswer,
        message:
          'Der KI-Prüfer ist gerade nicht erreichbar; die Antwort wurde nicht gewertet.',
      };
    }
    const pending = pendingRejectedResult(assessment, data, expectedAnswer);
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
      expectedAnswer,
    });
  });
