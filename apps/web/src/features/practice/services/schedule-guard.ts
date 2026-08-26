import type { CardState, ReviewMode } from '@wordhold/db/schema/practice';

type ScheduledCard = {
  readonly state: CardState;
  readonly dueAt: Date | null;
};

// Whether an answer is allowed to move the card's FSRS schedule.
//
// The scheduled queue only ever offers cards it asked for, so its answers
// always count. A drill is different: it is chosen the night before a class
// test, and a word that was not due has nothing to prove. Writing a new
// interval from a crammed answer would push a word the learner barely knows
// weeks out, which is the one thing drilling must not do.
//
// A card still working through FSRS's learning or relearning steps is the
// exception. Those steps exist to be answered again within minutes, and that
// includes the repeat of a card missed moments ago in the same drill.
export const advancesSchedule = (
  mode: ReviewMode,
  card: ScheduledCard,
  now: Date,
): boolean =>
  mode === 'scheduled' ||
  card.state !== 'review' ||
  (card.dueAt !== null && card.dueAt.getTime() <= now.getTime());
