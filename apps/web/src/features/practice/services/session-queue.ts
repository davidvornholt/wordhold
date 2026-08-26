import type { PracticeItem } from '../schemas/practice-models';

// How many other cards come between a missed card and its repeat. Far enough
// that the answer is no longer on screen, close enough that the session still
// ends.
const repeatGap = 3;

type QueuedCard = PracticeItem & {
  // Whether this card has already been missed in this session. A card is only
  // ever counted once, however often it comes back.
  readonly repeated: boolean;
};

export type SessionQueue = {
  readonly pending: ReadonlyArray<QueuedCard>;
  readonly settled: number;
  readonly total: number;
  readonly correct: number;
  readonly wrong: number;
};

export type AnswerOutcome =
  | { readonly graded: false }
  | {
      readonly graded: true;
      readonly correct: boolean;
      readonly revision: number;
    };

export const createSessionQueue = (
  items: ReadonlyArray<PracticeItem>,
): SessionQueue => ({
  pending: items.map((item) => ({ ...item, repeated: false })),
  settled: 0,
  total: items.length,
  correct: 0,
  wrong: 0,
});

const settleCorrect = (
  queue: SessionQueue,
  card: QueuedCard,
): SessionQueue => ({
  ...queue,
  pending: queue.pending.slice(1),
  settled: queue.settled + 1,
  correct: card.repeated ? queue.correct : queue.correct + 1,
});

const requeue = (
  queue: SessionQueue,
  card: QueuedCard,
  revision: number,
): SessionQueue => {
  const rest = queue.pending.slice(1);
  const position = Math.min(repeatGap, rest.length);
  return {
    ...queue,
    // The card was answered, so its revision moved on; the repeat has to carry
    // the new one or the server rejects it as a stale submission.
    pending: [
      ...rest.slice(0, position),
      { ...card, revision, repeated: true },
      ...rest.slice(position),
    ],
    wrong: card.repeated ? queue.wrong : queue.wrong + 1,
  };
};

// Moves the session on by one answer. A missed card goes back into the queue
// instead of leaving the session, which is what keeps FSRS's one-minute
// relearning step from turning into "Üben" lighting up again two minutes after
// you finished. `settled` counts distinct cards done with, so the progress it
// feeds only ever moves forward.
export const advanceQueue = (
  queue: SessionQueue,
  outcome: AnswerOutcome,
): SessionQueue => {
  const card = queue.pending.at(0);
  if (card === undefined) {
    return queue;
  }
  if (!outcome.graded) {
    // The judge was unreachable and the card was left untouched. Asking again
    // in this session would only reach the same outage.
    return {
      ...queue,
      pending: queue.pending.slice(1),
      settled: queue.settled + 1,
    };
  }
  return outcome.correct
    ? settleCorrect(queue, card)
    : requeue(queue, card, outcome.revision);
};
