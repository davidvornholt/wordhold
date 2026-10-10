import type { LanguageCode } from '@wordhold/db/schema/courses';
import type {
  AnswerDirection,
  RelationDirection,
} from '@wordhold/db/schema/directions';

// The texts a card is asked and answered with. Practice, the learning pass
// and grading all read them through these helpers.
export type CardTexts = {
  readonly direction: AnswerDirection;
  readonly targetText: string;
  readonly nativeText: string;
  // For a synonym or antonym card, the words it asks for; empty otherwise.
  readonly relatedWords: ReadonlyArray<string>;
};

// The German text when the card asks for the foreign one, and the foreign
// word otherwise, also when the card asks for its synonyms or antonyms.
export const cardPrompt = (
  card: Pick<CardTexts, 'direction' | 'targetText' | 'nativeText'>,
): string =>
  card.direction === 'to_target' ? card.nativeText : card.targetText;

// What the card intends. A synonym or antonym card intends its whole list,
// though any one of those words is a right answer.
export const cardAnswer = (card: CardTexts): string => {
  switch (card.direction) {
    case 'to_target':
      return card.targetText;
    case 'to_native':
      return card.nativeText;
    case 'to_synonym':
    case 'to_antonym':
      return card.relatedWords.join(', ');
    default:
      return card.direction satisfies never;
  }
};

// Only a card that asks for the German text is answered in German.
export const answerLanguage = (
  direction: AnswerDirection,
  targetLanguage: LanguageCode,
): LanguageCode => (direction === 'to_native' ? 'de' : targetLanguage);

// The language of a prompt that is not German; undefined for a German one,
// which the page's own language already covers.
export const foreignPromptLanguage = (
  direction: AnswerDirection,
  targetLanguage: LanguageCode,
): LanguageCode | undefined =>
  direction === 'to_target' ? undefined : targetLanguage;

const relationQuestions = {
  de: { synonym: 'Synonym von', antonym: 'Gegenteil von' },
  en: { synonym: 'Synonym of', antonym: 'Opposite of' },
  es: { synonym: 'Sinónimo de', antonym: 'Antónimo de' },
  fr: { synonym: 'Synonyme de', antonym: 'Contraire de' },
} as const satisfies Record<
  LanguageCode,
  { readonly synonym: string; readonly antonym: string }
>;

// A synonym or antonym card asks in the course's language, as a test does.
export const relationQuestion = (
  direction: RelationDirection,
  language: LanguageCode,
): string => {
  const questions = relationQuestions[language];
  return direction === 'to_synonym' ? questions.synonym : questions.antonym;
};
