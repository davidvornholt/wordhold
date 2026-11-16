import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  // biome-ignore lint/suspicious/noDeprecatedImports: Only the positional overload is deprecated; this file calls the object form Drizzle recommends.
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { courses } from './courses';
import { type AnswerDirection, answerDirectionEnum } from './directions';
import { entries } from './entries';

// A test the learner prepares for: the entries it can ask and the directions
// it asks them in. Practising one runs rounds over all of its cards. A test
// stores no date and never changes the schedule; when it is over, the learner
// archives it.
export const exams = pgTable(
  'exams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    directions: answerDirectionEnum('directions')
      .array()
      .$type<Array<AnswerDirection>>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    // The ID the create form chose for one form fill, so saving the same fill
    // again after a lost answer finds this test instead of adding a second.
    // Tests created without one (before this column, or by a page loaded
    // before the deploy) have none, and any number of rows may.
    submissionId: uuid('submission_id'),
  },
  (table) => [
    index('exams_course_id').on(table.courseId),
    uniqueIndex('exams_course_submission_id').on(
      table.courseId,
      table.submissionId,
    ),
    check(
      'exams_directions_non_empty',
      sql`cardinality(${table.directions}) > 0`,
    ),
  ],
);

export const examEntries = pgTable(
  'exam_entries',
  {
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.examId, table.entryId] }),
    index('exam_entries_entry_id').on(table.entryId),
  ],
);

// One sitting over a test's cards. Which cards it asks is fixed when it
// starts, in `exam_round_cards`, so a round can be resumed and its score
// keeps its denominator when the test's words change later.
export const examRounds = pgTable(
  'exam_rounds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('exam_rounds_exam_id').on(table.examId, table.startedAt)],
);
