import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import type { DerivedRating } from './fsrs';

// Grading outcome as stored in reviews.grading. Ratings are always derived
// from outcomes, never self-reported.
export type GradeOutcome =
  | { readonly method: 'exact' }
  | { readonly method: 'judge'; readonly verdict: JudgeVerdictData };

const fastAnswerMs = 5000;

// FSRS grade values by name (ts-fsrs Rating enum).
export const ratings = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
} as const satisfies Record<string, DerivedRating>;

export const isCorrect = (outcome: GradeOutcome): boolean =>
  outcome.method === 'exact' || outcome.verdict.correct;

export const deriveRating = (
  outcome: GradeOutcome,
  elapsedMs: number | null,
): DerivedRating => {
  if (!isCorrect(outcome)) {
    return ratings.again;
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
