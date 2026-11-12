import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type {
  ExamReadiness,
  MissedCard,
  RoundScore,
} from '../schemas/exam-models';

// A round's counts as the store reads them.
export type RoundCountRow = {
  readonly id: string;
  readonly examId: string;
  readonly startedAt: Date;
  readonly total: number;
  readonly answered: number;
  readonly correct: number;
};

// One card of a round with the rating of its first answer there, or null
// while it is unanswered.
export type RoundCardRow = {
  readonly roundId: string;
  readonly cardId: string;
  readonly entryId: string;
  readonly direction: AnswerDirection;
  readonly targetText: string;
  readonly nativeText: string;
  readonly firstRating: number | null;
};

// Only "again" is wrong. A learner's own correction ("hard") counts as right,
// as it does for the schedule; a skipped card is stored as "again".
const answeredRight = (rating: number | null) => rating !== null && rating > 1;

export const roundScore = (row: RoundCountRow): RoundScore => ({
  id: row.id,
  startedAt: row.startedAt,
  total: row.total,
  answered: row.answered,
  correct: row.correct,
  completed: row.answered >= row.total,
});

// The newest round while it still has cards to answer. A newer round gives
// up any older one, so only the newest can be open.
export const openRound = (
  rounds: ReadonlyArray<RoundScore>,
): RoundScore | null => {
  const [newest] = rounds;
  return newest === undefined || newest.completed ? null : newest;
};

// The two newest completed rounds, which the readiness numbers compare.
export const comparedRounds = (rounds: ReadonlyArray<RoundScore>) =>
  rounds.filter((round) => round.completed).slice(0, 2);

const missedCard = ({
  cardId,
  entryId,
  direction,
  targetText,
  nativeText,
}: RoundCardRow): MissedCard => ({
  cardId,
  entryId,
  direction,
  targetText,
  nativeText,
});

// `rounds` are newest first; `cards` hold at least the cards of the two
// newest completed rounds.
export const examReadiness = (
  rounds: ReadonlyArray<RoundScore>,
  cards: ReadonlyArray<RoundCardRow>,
): ExamReadiness => {
  const [lastRound, previousRound] = comparedRounds(rounds);
  if (lastRound === undefined) {
    return {
      lastRound: null,
      previousRound: null,
      rightTwice: null,
      missed: [],
    };
  }
  const last = cards.filter((card) => card.roundId === lastRound.id);
  let rightTwice: number | null = null;
  if (previousRound !== undefined) {
    const rightBefore = new Set(
      cards
        .filter(
          (card) =>
            card.roundId === previousRound.id &&
            answeredRight(card.firstRating),
        )
        .map((card) => card.cardId),
    );
    rightTwice = last.filter(
      (card) => answeredRight(card.firstRating) && rightBefore.has(card.cardId),
    ).length;
  }
  return {
    lastRound,
    previousRound: previousRound ?? null,
    rightTwice,
    missed: last
      .filter((card) => !answeredRight(card.firstRating))
      .map(missedCard),
  };
};
