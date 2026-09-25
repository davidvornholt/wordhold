import {
  boolean,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { books } from './books';
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
    // Nullable only while deployed databases file their existing units into a
    // book; see the books rollout in the package README. A book that still
    // holds units cannot be deleted, while deleting the course removes both.
    bookId: uuid('book_id'),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    isHolding: boolean('is_holding').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'units_book_course_books_id_course_fk',
      columns: [table.bookId, table.courseId],
      foreignColumns: [books.id, books.courseId],
    }),
    uniqueIndex('units_book_name').on(table.bookId, table.name),
    uniqueIndex('units_book_position').on(table.bookId, table.position),
    uniqueIndex('units_id_course').on(table.id, table.courseId),
  ],
);
