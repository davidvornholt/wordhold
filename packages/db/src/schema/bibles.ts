import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  // biome-ignore lint/suspicious/noDeprecatedImports: Only the positional overload is deprecated; this file calls the object form Drizzle recommends.
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

// A Bible translation a person uploaded to look up passages for their
// collections. Translations are usually under copyright, so each one is
// private to the person who uploaded it and goes with their account.
export const bibles = pgTable(
  'bibles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    abbreviation: text('abbreviation').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('bibles_owner_abbreviation').on(
      table.ownerId,
      table.abbreviation,
    ),
  ],
);

// One verse as the translation numbers it, which can differ from the
// numbering of the file it came from. Books are numbered 1 to 66 from
// Genesis to Revelation. The text is plain: headings and footnotes are left
// out, and each line of poetry is a line of its own.
export const bibleVerses = pgTable(
  'bible_verses',
  {
    bibleId: uuid('bible_id')
      .notNull()
      .references(() => bibles.id, { onDelete: 'cascade' }),
    book: smallint('book').notNull(),
    chapter: smallint('chapter').notNull(),
    verse: smallint('verse').notNull(),
    text: text('text').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.bibleId, table.book, table.chapter, table.verse],
    }),
    check(
      'bible_verses_position',
      sql`${table.book} between 1 and 66 and ${table.chapter} > 0 and ${table.verse} > 0`,
    ),
  ],
);
