import type { JudgeInput } from '@wordhold/ai/judge/schema';
import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { isRelationDirection } from '../../../shared/directions';
import { englishNames } from '../../../shared/languages';
import { cardPrompt } from '../../../shared/practice/card-texts';

type VocabularyCard = {
  readonly direction: AnswerDirection;
  readonly targetText: string;
  readonly nativeText: string;
  readonly targetLanguage: LanguageCode;
};

// What the judge reads for a word's card. Grading and the review repair
// build it the same way, so a repaired verdict has the cache identity of a
// graded one. A synonym or antonym is judged in the sense the word's German
// meaning names.
export const vocabularyJudgeInput = (
  card: VocabularyCard,
  expectedAnswers: ReadonlyArray<string>,
  givenAnswer: string,
): JudgeInput => {
  const answer = {
    targetLanguage: englishNames[card.targetLanguage],
    prompt: cardPrompt(card),
    expectedAnswers,
    givenAnswer,
  };
  return isRelationDirection(card.direction)
    ? { ...answer, direction: card.direction, meaning: card.nativeText }
    : { ...answer, direction: card.direction };
};
