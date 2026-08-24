import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
