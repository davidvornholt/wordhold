import {
  type DefinitionVerdictData,
  isDefinitionCorrect,
} from '@wordhold/ai/definition/schema';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { allowedMistakes, compareRecitation } from './recitation';

export type DerivedRating = 1 | 2 | 3 | 4;

// Grading outcome as stored in reviews.grading. A learner correction records
// the rejected assessment it replaced without teaching the matcher that the
// submitted typo is valid. A definition keeps the key points it was graded
// against, since the learner can edit them later. A recited text keeps its
// counts; the words themselves can be compared again from the answer.
export type AssessedGradeOutcome =
  | { readonly method: 'exact' }
  | { readonly method: 'judge'; readonly verdict: JudgeVerdictData }
  | {
      readonly method: 'definition';
      readonly keyPoints: ReadonlyArray<string>;
      readonly verdict: DefinitionVerdictData;
    }
  | {
      readonly method: 'recitation';
      readonly words: number;
      readonly mistakes: number;
      readonly typos: number;
    };

export type RecitationOutcome = Extract<
  AssessedGradeOutcome,
  { readonly method: 'recitation' }
>;

export const gradeRecitation = (
  original: string,
  recited: string,
): RecitationOutcome => {
  const { words, mistakes, typos } = compareRecitation(original, recited);
  return { method: 'recitation', words, mistakes, typos };
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
    case 'recitation':
      return outcome.mistakes <= allowedMistakes(outcome.words);
    case 'skip':
      return false;
    default:
      return outcome satisfies never;
  }
};

// Typos aside, a text recited word for word is known. A few mistakes in a
// long text still count as recalled, but with effort.
const recitationRating = (outcome: RecitationOutcome): DerivedRating => {
  if (outcome.mistakes === 0) {
    return ratings.good;
  }
  return isCorrect(outcome) ? ratings.hard : ratings.again;
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
  if (outcome.method === 'recitation') {
    return recitationRating(outcome);
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
