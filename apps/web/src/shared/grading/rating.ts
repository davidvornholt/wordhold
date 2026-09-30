import {
  type DefinitionVerdictData,
  isDefinitionCorrect,
} from '@wordhold/ai/definition/schema';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';

export type DerivedRating = 1 | 2 | 3 | 4;

// Grading outcome as stored in reviews.grading. A learner correction records
// the rejected assessment it replaced without teaching the matcher that the
// submitted typo is valid. A definition keeps the key points it was graded
// against, since the learner can edit them later.
export type AssessedGradeOutcome =
  | { readonly method: 'exact' }
  | { readonly method: 'judge'; readonly verdict: JudgeVerdictData }
  | {
      readonly method: 'definition';
      readonly keyPoints: ReadonlyArray<string>;
      readonly verdict: DefinitionVerdictData;
    };

export type GradeOutcome =
  | AssessedGradeOutcome
  | {
      readonly method: 'learner-correction';
      readonly assessed: AssessedGradeOutcome;
    }
  // The learner revealed the answer without attempting one: always a lapse.
  | { readonly method: 'skip' };

const fastAnswerMs = 5000;

// FSRS grade values by name (ts-fsrs Rating enum).
export const ratings = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
} as const satisfies Record<string, DerivedRating>;

export const isCorrect = (outcome: GradeOutcome): boolean => {
  switch (outcome.method) {
    case 'exact':
    case 'learner-correction':
      return true;
    case 'judge':
      return outcome.verdict.correct;
    case 'definition':
      return isDefinitionCorrect(outcome.verdict);
    case 'skip':
      return false;
    default:
      return outcome satisfies never;
  }
};

export const deriveRating = (
  outcome: GradeOutcome,
  elapsedMs: number | null,
): DerivedRating => {
  if (outcome.method === 'skip') {
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
  // A definition has no degrees of correct: every key point is there or the
  // answer is wrong. The time taken says little about a written sentence.
  if (outcome.method === 'definition') {
    return isDefinitionCorrect(outcome.verdict) ? ratings.good : ratings.again;
  }
  const { verdict } = outcome;
  if (!verdict.correct) {
    return ratings.again;
  }
  const flawless =
    verdict.meaning.ok &&
    verdict.grammar.ok &&
    verdict.idiomaticity.ok &&
    verdict.spelling.ok &&
    verdict.intendedConstruction.ok;
  return flawless ? ratings.good : ratings.hard;
};
