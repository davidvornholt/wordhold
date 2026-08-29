import { pgEnum } from 'drizzle-orm/pg-core';

// Which way round a vocabulary entry is asked. `to_target` shows the German
// text and asks for the foreign text; `to_native` reverses those roles.
// The native side is always German. Entries, cards, reviews and a course's
// enabled directions all speak this, so it lives here rather than in any one
// of their tables.
export const answerDirections = ['to_target', 'to_native'] as const;
export type AnswerDirection = (typeof answerDirections)[number];
export const answerDirectionEnum = pgEnum('answer_direction', answerDirections);
