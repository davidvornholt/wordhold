// Boundary to the ts-fsrs scheduler, which speaks snake_case (scoped
// useNamingConvention override in the root biome.jsonc).
import type { CardState, cards } from '@wordhold/db/schema/practice';
import { type Card, createEmptyCard, fsrs, type Grade, State } from 'ts-fsrs';
import type { DerivedRating } from '../../../shared/grading/rating';

type CardRow = typeof cards.$inferSelect;

const scheduler = fsrs();

const stateByName: Record<CardState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

const nameByState: Record<State, CardState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const toFsrsCard = (row: CardRow, now: Date): Card => {
  if (row.stability === null || row.difficulty === null) {
    return createEmptyCard(now);
  }
  return {
    due: row.dueAt ?? now,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: 0,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: stateByName[row.state],
    ...(row.lastReviewedAt === null ? {} : { last_review: row.lastReviewedAt }),
  };
};

// Returns the column updates for one graded review.
export const applyRating = (row: CardRow, rating: DerivedRating, now: Date) => {
  const { card } = scheduler.next(toFsrsCard(row, now), now, rating as Grade);
  return {
    state: nameByState[card.state],
    dueAt: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    lastReviewedAt: now,
  };
};
