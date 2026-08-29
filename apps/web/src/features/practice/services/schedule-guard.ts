import type { CardState } from '@wordhold/db/schema/practice';

type ScheduledCard = {
  readonly state: CardState;
  readonly dueAt: Date | null;
};

// Whether an answer is allowed to move the card's FSRS schedule.
//
// The server decides from the stored card, never from the client-reported
// sitting mode. A review card that is not due has nothing to prove. Writing a
// new interval from a crammed answer would push an entry the learner barely
// knows weeks out.
//
// A card still working through FSRS's learning or relearning steps is the
// exception. Those steps exist to be answered again within minutes, and that
// includes the repeat of a card missed moments ago in the same free practice.
export const advancesSchedule = (
  card: ScheduledCard,
  now: Date,
  correct: boolean,
): boolean =>
  !correct ||
  card.state !== 'review' ||
  (card.dueAt !== null && card.dueAt.getTime() <= now.getTime());
