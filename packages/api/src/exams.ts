import { Schema } from 'effect';
import { DirectionSchema, IdSchema } from './vocabulary';

// A test is a set of a course's words and the directions it asks them in.
// The learner practises it in rounds in the app; a round asks every learned
// card of the test once. Wordhold shows the numbers below and gives no
// verdict of its own on whether the learner is ready.

const Instant = Schema.String;
const Count = Schema.Number;

/**
 * Each card of a round counts with its first answer in it. A round is
 * complete once every card has one.
 */
export const ExamRoundSchema = Schema.Struct({
  id: IdSchema,
  startedAt: Instant,
  total: Count,
  answered: Count,
  correct: Count,
  completed: Schema.Boolean,
});
export type ExamRound = typeof ExamRoundSchema.Type;

const examFields = {
  id: IdSchema,
  courseId: IdSchema,
  name: Schema.String,
  directions: Schema.Array(DirectionSchema),
  createdAt: Instant,
  /** An archived test keeps its rounds and starts no new one. */
  archivedAt: Schema.NullOr(Instant),
  entryCount: Count,
};

export const ExamSummarySchema = Schema.Struct({
  ...examFields,
  /** The newest completed round. */
  lastRound: Schema.NullOr(ExamRoundSchema),
});
export type ExamSummary = typeof ExamSummarySchema.Type;

const ExamEntrySchema = Schema.Struct({
  id: IdSchema,
  targetText: Schema.String,
  nativeText: Schema.String,
});

const MissedCardSchema = Schema.Struct({
  entryId: IdSchema,
  direction: DirectionSchema,
  targetText: Schema.String,
  nativeText: Schema.String,
});

export const ExamSchema = Schema.Struct({
  ...examFields,
  /** In course order. */
  entries: Schema.Array(ExamEntrySchema),
  /**
   * The test's cards in its directions as they stand now. A round asks only
   * the learned ones; the others wait until the learner meets them.
   */
  cards: Schema.Struct({
    learned: Count,
    unlearned: Count,
    unlearnedEntryIds: Schema.Array(IdSchema),
  }),
  /**
   * Newest first. An unfinished round other than `openRound` was given up
   * when a newer one started.
   */
  rounds: Schema.Array(ExamRoundSchema),
  /** The newest round, while it still has cards to answer. */
  openRound: Schema.NullOr(ExamRoundSchema),
  readiness: Schema.Struct({
    /** The newest completed round, and the completed round before it. */
    lastRound: Schema.NullOr(ExamRoundSchema),
    previousRound: Schema.NullOr(ExamRoundSchema),
    /** Cards right in both of those rounds; null until there are two. */
    rightTwice: Schema.NullOr(Count),
    /** The cards answered wrong in the newest completed round. */
    missed: Schema.Array(MissedCardSchema),
  }),
});
export type Exam = typeof ExamSchema.Type;
