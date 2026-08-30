import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { courses } from './courses';

export const pageStatuses = ['awaiting_verification', 'verified'] as const;
export type PageStatus = (typeof pageStatuses)[number];
export const pageStatusEnum = pgEnum('page_status', pageStatuses);

// A captured textbook page. The image is kept permanently as provenance;
// `extraction` holds the raw model output between capture and human
// verification, after which entries reference the page directly.
export const pages = pgTable(
  'pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    importSessionId: uuid('import_session_id').notNull().defaultRandom(),
    importPosition: integer('import_position').notNull().default(0),
    importExpectedCount: integer('import_expected_count').notNull().default(1),
    imagePath: text('image_path').notNull(),
    extraction: jsonb('extraction'),
    status: pageStatusEnum('status').notNull().default('awaiting_verification'),
    capturedAt: timestamp('captured_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'pages_import_position_non_negative',
      sql`${table.importPosition} >= 0`,
    ),
    check(
      'pages_import_expected_count_valid',
      sql`${table.importExpectedCount} between 1 and 10`,
    ),
    check(
      'pages_import_position_within_expected_count',
      sql`${table.importPosition} < ${table.importExpectedCount}`,
    ),
    uniqueIndex('pages_import_session_position_unique').on(
      table.importSessionId,
      table.importPosition,
    ),
  ],
);
