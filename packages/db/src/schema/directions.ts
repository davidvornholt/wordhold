import { pgEnum } from 'drizzle-orm/pg-core';

// What a card asks. `to_target` shows the German text and asks for the
// foreign text; `to_native` reverses those roles. The native side is always
// German. `to_synonym` and `to_antonym` show the foreign word and ask for one
// of its stored synonyms or antonyms in the same language; a word has these
// cards only while it has such a list. Entries, cards, reviews and a course's
// enabled directions all speak this, so it lives here rather than in any one
// of their tables.
export const translationDirections = ['to_target', 'to_native'] as const;
export type TranslationDirection = (typeof translationDirections)[number];
export const relationDirections = ['to_synonym', 'to_antonym'] as const;
export type RelationDirection = (typeof relationDirections)[number];
export const answerDirections = [
  ...translationDirections,
  ...relationDirections,
] as const;
export type AnswerDirection = (typeof answerDirections)[number];
export const answerDirectionEnum = pgEnum('answer_direction', answerDirections);
