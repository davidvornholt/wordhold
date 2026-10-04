import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { answerDirectionEnum, answerDirections } from './directions';

export const languageCodes = ['de', 'en', 'es', 'fr'] as const;
export type LanguageCode = (typeof languageCodes)[number];
export const languageEnum = pgEnum('language', languageCodes);

// What a course teaches. A `language` course pairs foreign words with German
// ones. A `terms` course pairs German technical terms of one subject with
// their definitions: an entry's `target_text` is the term, its `native_text`
// the definition, and the only direction asked is term to definition. A
// `texts` course collects texts learned word for word, such as Bible verses:
// `target_text` is the title or reference, `native_text` the text itself,
// and the only direction asked is title to text.
export const courseKinds = ['language', 'terms', 'texts'] as const;
export type CourseKind = (typeof courseKinds)[number];
export const courseKindEnum = pgEnum('course_kind', courseKinds);

// A course is one language, subject or collection the learner studies: the
// organizing unit for books, pages, entries, and practice sessions. Sessions
// are always course-scoped. Each course belongs to one person, and all of its
// data goes with it when that person is deleted.
export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Nullable only until the administrator claims the courses created before
    // accounts existed; see the package README for the second phase.
    ownerId: text('owner_id').references(() => user.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    kind: courseKindEnum('kind').notNull().default('language'),
    targetLanguage: languageEnum('target_language').notNull(),
    nativeLanguage: languageEnum('native_language').notNull().default('de'),
    // Which directions this course is practised in. A direction taken out is
    // hidden rather than deleted: its cards keep their schedule, stop being
    // asked, counted and scheduled, and pick up where they left off if it is
    // put back.
    directions: answerDirectionEnum('directions')
      .array()
      .notNull()
      .default([...answerDirections]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('courses_owner_id').on(table.ownerId),
    check(
      'courses_directions_non_empty',
      sql`cardinality(${table.directions}) > 0`,
    ),
    // Every course other than a language is German on both sides and asks
    // only for the entry's second side, which is why its direction settings
    // are not offered.
    check(
      'courses_list_shape',
      sql`${table.kind} = 'language' or (${table.targetLanguage} = ${table.nativeLanguage} and ${table.directions} = '{to_native}'::answer_direction[])`,
    ),
  ],
);
