import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { answerDirectionEnum } from './directions';
import { entries } from './entries';

export const cardStates = ['new', 'learning', 'review', 'relearning'] as const;
export type CardState = (typeof cardStates)[number];
export const cardStateEnum = pgEnum('card_state', cardStates);

// One FSRS-scheduled card per (entry, direction). Ratings are derived from
// grading outcomes, never self-reported.
export const cards = pgTable(
  'cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    direction: answerDirectionEnum('direction').notNull(),
    // When the learner first met this word in the learning pass, null until
    // then. Deliberately not folded into `state`: `state` says where the card
    // stands in the FSRS state machine, this says whether the person has ever
    // seen the word at all. A card that has not been introduced is never
    // scheduled, never counted, and never asked.
    introducedAt: timestamp('introduced_at', { withTimezone: true }),
    state: cardStateEnum('state').notNull().default('new'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    stability: real('stability'),
    difficulty: real('difficulty'),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    scheduledDays: real('scheduled_days').notNull().default(0),
    learningSteps: integer('learning_steps').notNull().default(0),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    revision: integer('revision').notNull().default(0),
  },
  (table) => [
    uniqueIndex('cards_entry_direction').on(table.entryId, table.direction),
  ],
);

// Where an answer came from. `scheduled` is the ordinary session queue;
// `drill` is a unit drilled on purpose, which is worth practising but is not
// evidence that the schedule asked for the word. Statistics have to be able
// to tell them apart.
export const reviewModes = ['scheduled', 'drill'] as const;
export type ReviewMode = (typeof reviewModes)[number];
export const reviewModeEnum = pgEnum('review_mode', reviewModes);

// Full review log: FSRS parameter fitting and the dashboard's fragile-words
// view both need per-review history, not just current card state.
export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  rating: smallint('rating').notNull(),
  mode: reviewModeEnum('mode').notNull().default('scheduled'),
  answerText: text('answer_text').notNull(),
  grading: jsonb('grading'),
  elapsedMs: integer('elapsed_ms'),
});

// Judge verdicts cached per (entry, direction, normalized answer): repeating
// the same wrong answer never re-bills a model call.
export const judgeCache = pgTable(
  'judge_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    direction: answerDirectionEnum('direction').notNull(),
    normalizedAnswer: text('normalized_answer').notNull(),
    verdict: jsonb('verdict').notNull(),
    model: text('model').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('judge_cache_entry_direction_answer').on(
      table.entryId,
      table.direction,
      table.normalizedAnswer,
    ),
  ],
);
