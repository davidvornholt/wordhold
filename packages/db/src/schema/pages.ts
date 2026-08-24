import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { courses } from './courses';

export const pageStatuses = ['awaiting_verification', 'verified'] as const;
export type PageStatus = (typeof pageStatuses)[number];
export const pageStatusEnum = pgEnum('page_status', pageStatuses);

// A captured textbook page. The image is kept permanently as provenance;
// `extraction` holds the raw model output between capture and human
// verification, after which entries reference the page directly.
export const pages = pgTable('pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  label: text('label'),
  imagePath: text('image_path').notNull(),
  extraction: jsonb('extraction'),
  status: pageStatusEnum('status').notNull().default('awaiting_verification'),
  capturedAt: timestamp('captured_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
});
