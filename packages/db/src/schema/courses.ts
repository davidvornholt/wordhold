import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { answerDirectionEnum, answerDirections } from './directions';

export const languageCodes = ['de', 'en', 'es', 'fr'] as const;
export type LanguageCode = (typeof languageCodes)[number];
export const languageEnum = pgEnum('language', languageCodes);

// A course is one physical textbook: the organizing unit for pages, entries,
// and practice sessions. Sessions are always course-scoped.
export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  targetLanguage: languageEnum('target_language').notNull(),
  nativeLanguage: languageEnum('native_language').notNull().default('de'),
  // Which directions this course is practised in. A direction taken out is
  // hidden rather than deleted: its cards keep their schedule, stop being
  // asked, counted and scheduled, and pick up where they left off if it is put
  // back. At least one direction always stays, enforced by the service.
  directions: answerDirectionEnum('directions')
    .array()
    .notNull()
    .default([...answerDirections]),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
