// Boundary to the ts-fsrs scheduler. It lives next to the cards schema because
// both the app and the migration runner derive card schedules from it.
import { DateTime } from 'effect';
import { DefaultScheduler, type Grade, State } from 'ts-fsrs';
import type { CardState, cards } from './schema/practice';

// The scheduling columns of a card, which is all a rating reads.
export type CardSchedule = Pick<
  typeof cards.$inferSelect,
  | 'state'
  | 'dueAt'
  | 'stability'
  | 'stabilityFast'
  | 'difficulty'
  | 'reps'
  | 'lapses'
  | 'scheduledDays'
  | 'learningSteps'
  | 'lastReviewedAt'
>;

export const unscheduled: CardSchedule = {
  state: 'new',
  dueAt: null,
  stability: null,
  stabilityFast: null,
  difficulty: null,
  reps: 0,
  lapses: 0,
  scheduledDays: 0,
  learningSteps: 0,
  lastReviewedAt: null,
};

// FSRS-7 with the library's default weights, retention, and learning steps.
const scheduler = await DefaultScheduler({ version: 'FSRS-7' });

// Fuzzing is off, and it is the only reader of the card id.
const cardId = 'wordhold-card';

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

const statusByName = {
  new: 'new',
  learning: 'learning',
  review: 'review',
  relearning: 'learning',
} as const satisfies Record<CardState, string>;

const toSchedulerCard = (row: CardSchedule, now: Date) => {
  if (row.stability === null) {
    return scheduler.newCard({ now, cardId });
  }
  if (row.stabilityFast === null || row.difficulty === null) {
    // The migration runner rebuilds every reviewed card's FSRS-7 memory, so a
    // half-filled memory is a defect, never a card to start over.
    throw new Error('A reviewed card is missing its FSRS-7 memory state.');
  }
  return {
    cardId,
    stability: row.stability,
    stabilityFast: row.stabilityFast,
    difficulty: row.difficulty,
    state: stateByName[row.state],
    scheduleStatus: statusByName[row.state],
    dueAt: row.dueAt ?? now,
    lastReviewAt: row.lastReviewedAt,
    reps: row.reps,
    lapses: row.lapses,
    scheduledDays: row.scheduledDays,
    learningStep: row.learningSteps,
  };
};

// FSRS-7 times a card to the minute, so a word answered at 14:05 would come
// back at 00:15 or 16:40 on some later day. Practice happens in days, so a
// card due on a later day than it was answered is due from the start of that
// day in the owner's zone, the day boundary of "heute" and the streak. A
// step later the same day keeps its time. The scheduler reads the time of
// the last answer, never the due time, so this changes no interval.
const dueFrom = (dueAt: Date, answeredAt: Date, timeZone: string): Date => {
  const dayStart = DateTime.toDateUtc(
    DateTime.startOf(DateTime.makeZonedUnsafe(dueAt, { timeZone }), 'day'),
  );
  return dayStart.getTime() > answeredAt.getTime() ? dayStart : dueAt;
};

type RatedSchedule = CardSchedule & {
  readonly dueAt: Date;
  readonly lastReviewedAt: Date;
};

// The schedule FSRS gives, due to the minute.
const rate = (row: CardSchedule, rating: Grade, now: Date): RatedSchedule => {
  const { card } = scheduler.review({
    card: toSchedulerCard(row, now),
    grade: rating,
    now,
  });
  return {
    state: nameByState[card.state],
    dueAt: card.dueAt,
    stability: card.stability,
    stabilityFast: card.stabilityFast,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    scheduledDays: card.scheduledDays,
    learningSteps: card.learningStep,
    lastReviewedAt: now,
  };
};

// Returns the column updates for one graded review. `timeZone` is the
// owner's IANA zone.
export const applyRating = (
  row: CardSchedule,
  rating: Grade,
  now: Date,
  timeZone: string,
): RatedSchedule => {
  const rated = rate(row, rating, now);
  return { ...rated, dueAt: dueFrom(rated.dueAt, now, timeZone) };
};

type ScheduledCard = Pick<CardSchedule, 'state' | 'dueAt'>;

// Whether an answer is allowed to move the card's FSRS schedule.
//
// The server decides from the stored card, never from the client-reported
// sitting mode. A review card that is not due has nothing to prove. Writing a
// new interval from a crammed answer would push an entry the learner barely
// knows weeks out.
//
// A card still working through FSRS's learning or relearning steps is the
// exception. Those steps exist to be answered again within minutes, and that
// includes the repeat of a card missed moments ago in the same custom sitting.
export const advancesSchedule = (
  card: ScheduledCard,
  now: Date,
  correct: boolean,
): boolean =>
  !correct ||
  card.state !== 'review' ||
  (card.dueAt !== null && card.dueAt.getTime() <= now.getTime());

export type ReplayedReview = {
  readonly reviewedAt: Date;
  readonly rating: Grade;
};

// When due dates began to start at midnight, give or take the minutes the
// release took. Before it, the early-review guard held a right answer given
// on its due day but before FSRS's minute, so such answers are replayed
// against the due time they had then.
const dueDaysSince = new Date('2026-11-20T16:00:00Z');

// The schedule a card's answers produce from scratch, in answer order, with
// the same early-review guard as live practice.
export const replayReviews = (
  reviews: ReadonlyArray<ReplayedReview>,
  timeZone: string,
): CardSchedule => {
  let card = unscheduled;
  for (const review of reviews) {
    if (advancesSchedule(card, review.reviewedAt, review.rating !== 1)) {
      card =
        review.reviewedAt.getTime() < dueDaysSince.getTime()
          ? rate(card, review.rating, review.reviewedAt)
          : applyRating(card, review.rating, review.reviewedAt, timeZone);
    }
  }
  return card.dueAt === null || card.lastReviewedAt === null
    ? card
    : { ...card, dueAt: dueFrom(card.dueAt, card.lastReviewedAt, timeZone) };
};
