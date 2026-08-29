import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';

export type DerivedRating = 1 | 2 | 3 | 4;

// Grading outcome as stored in reviews.grading. A learner correction records
// the rejected assessment it replaced without teaching the matcher that the
// submitted typo is valid.
export type AssessedGradeOutcome =
  | { readonly method: 'exact' }
  | { readonly method: 'judge'; readonly verdict: JudgeVerdictData };

export type GradeOutcome =
  | AssessedGradeOutcome
  | {
      readonly method: 'learner-correction';
      readonly assessed: AssessedGradeOutcome;
    };

const fastAnswerMs = 5000;

// FSRS grade values by name (ts-fsrs Rating enum).
export const ratings = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
} as const satisfies Record<string, DerivedRating>;

export const isCorrect = (outcome: GradeOutcome): boolean =>
  outcome.method === 'exact' ||
  outcome.method === 'learner-correction' ||
  outcome.verdict.correct;

export const deriveRating = (
  outcome: GradeOutcome,
  elapsedMs: number | null,
): DerivedRating => {
  if (!isCorrect(outcome)) {
    return ratings.again;
  }
  if (outcome.method === 'learner-correction') {
    return ratings.hard;
  }
  if (outcome.method === 'exact') {
    return elapsedMs !== null && elapsedMs < fastAnswerMs
      ? ratings.easy
      : ratings.good;
  }
  const { verdict } = outcome;
  const flawless =
    verdict.meaning.ok &&
    verdict.grammar.ok &&
    verdict.idiomaticity.ok &&
    verdict.spelling.ok &&
    verdict.intendedConstruction.ok;
  return flawless ? ratings.good : ratings.hard;
};
