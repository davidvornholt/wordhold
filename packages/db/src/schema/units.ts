import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { courses } from './courses';

// A unit is one chapter of a textbook: the grouping a teacher names when
// setting homework, and the grouping a learner works through before being
// tested on it. Pages record which photo an entry came from; units record which
// part of the book it belongs to, and one unit usually spans several photos.
export const units = pgTable(
  'units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    isHolding: boolean('is_holding').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('units_course_name').on(table.courseId, table.name),
    uniqueIndex('units_course_position').on(table.courseId, table.position),
    uniqueIndex('units_id_course').on(table.id, table.courseId),
  ],
);
