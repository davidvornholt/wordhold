import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { courses } from './courses';

// A book is one textbook inside a language course, such as "Encuentros hoy 2"
// next to "Encuentros hoy 3" in the Spanish course. Practice and duplicate
// detection stay course-wide; the book keeps chapters of different volumes
// apart when they share a name.
export const books = pgTable(
  'books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('books_course_name').on(table.courseId, table.name),
    uniqueIndex('books_course_position').on(table.courseId, table.position),
    uniqueIndex('books_id_course').on(table.id, table.courseId),
  ],
);
