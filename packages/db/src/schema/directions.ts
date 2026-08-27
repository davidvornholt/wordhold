import { pgEnum } from 'drizzle-orm/pg-core';

// Which way round a word is asked. `to_target` shows the German and asks for
// the foreign word; `to_native` shows the foreign word and asks for the
// German. Entries, cards, reviews and a course's enabled directions all speak
// this, so it lives here rather than in any one of their tables.
export const answerDirections = ['to_target', 'to_native'] as const;
export type AnswerDirection = (typeof answerDirections)[number];
export const answerDirectionEnum = pgEnum('answer_direction', answerDirections);
