import {
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
import { pages } from './pages';
import { units } from './units';

export const entryTypes = ['word', 'expression', 'sentence'] as const;
export type EntryType = (typeof entryTypes)[number];
export const entryTypeEnum = pgEnum('entry_type', entryTypes);

// A structured vocabulary entry, not a flashcard. `grammar` stays a flexible
// per-language shape (validated by Effect Schema unions in the app) holding
// only what the textbook page actually shows.
export const entries = pgTable('entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  // A unit outlives the photo it was captured from, so deleting a page only
  // clears provenance. Deleting a unit that still holds vocabulary is refused
  // rather than silently taking the words with it.
  unitId: uuid('unit_id')
    .notNull()
    .references(() => units.id, { onDelete: 'restrict' }),
  pageId: uuid('page_id').references(() => pages.id, {
    onDelete: 'set null',
  }),
  type: entryTypeEnum('type').notNull(),
  targetText: text('target_text').notNull(),
  nativeText: text('native_text').notNull(),
  grammar: jsonb('grammar'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const exampleSources = ['textbook', 'generated'] as const;
export const exampleSourceEnum = pgEnum('example_source', exampleSources);

export const entryExamples = pgTable('entry_examples', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryId: uuid('entry_id')
    .notNull()
    .references(() => entries.id, { onDelete: 'cascade' }),
  targetText: text('target_text').notNull(),
  nativeText: text('native_text'),
  source: exampleSourceEnum('source').notNull().default('textbook'),
  position: integer('position').notNull().default(0),
});

export const answerDirections = ['to_target', 'to_native'] as const;
export type AnswerDirection = (typeof answerDirections)[number];
export const answerDirectionEnum = pgEnum('answer_direction', answerDirections);

export const answerSources = ['textbook', 'manual', 'judge'] as const;
export const answerSourceEnum = pgEnum('answer_source', answerSources);

// The deterministic grading path: one row per accepted rendering, per
// direction. Seeded from the textbook at import; grown by judge write-back,
// so repeated correct answers stop costing model calls.
export const acceptedAnswers = pgTable(
  'accepted_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    direction: answerDirectionEnum('direction').notNull(),
    text: text('text').notNull(),
    normalized: text('normalized').notNull(),
    source: answerSourceEnum('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('accepted_answers_entry_direction_normalized').on(
      table.entryId,
      table.direction,
      table.normalized,
    ),
  ],
);

export const entryAudio = pgTable(
  'entry_audio',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    voice: text('voice').notNull(),
    path: text('path').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('entry_audio_entry_voice').on(table.entryId, table.voice),
  ],
);
