import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { countNoun } from '../../../shared/format/count';
import type { MissedCard, RoundScore } from '../schemas/exam-models';

const percentFactor = 100;

export const scoreText = (round: RoundScore): string =>
  `${round.correct} von ${round.total} richtig`;

export const scorePercent = (round: RoundScore): number =>
  round.total === 0
    ? 0
    : Math.round((round.correct / round.total) * percentFactor);

// Compared in percent, because the test may have gained or lost cards
// between the two rounds.
export const trendText = (last: RoundScore, previous: RoundScore): string => {
  const change = scorePercent(last) - scorePercent(previous);
  if (change === 0) {
    return 'so gut wie die Runde davor';
  }
  const points = countNoun(Math.abs(change), 'Prozentpunkt', 'Prozentpunkte');
  return change > 0
    ? `${points} besser als davor`
    : `${points} schlechter als davor`;
};

// The chart shows the newest completed rounds, oldest first, few enough for
// each bar to carry its own label on a phone.
export const chartedRounds = 8;

export const completedRounds = (
  rounds: ReadonlyArray<RoundScore>,
): ReadonlyArray<RoundScore> =>
  rounds
    .filter((round) => round.completed)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    .slice(-chartedRounds);

export type RoundPart = {
  readonly kind: 'right-twice' | 'right-last' | 'right' | 'wrong';
  readonly label: string;
  readonly count: number;
};

// The newest completed round's cards by how they went. Until there is a
// round before it, a right card is only right.
export const roundParts = (
  last: RoundScore,
  rightTwice: number | null,
): ReadonlyArray<RoundPart> => {
  const wrong = {
    kind: 'wrong',
    label: 'falsch',
    count: last.total - last.correct,
  } as const;
  if (rightTwice === null) {
    return [{ kind: 'right', label: 'richtig', count: last.correct }, wrong];
  }
  return [
    { kind: 'right-twice', label: 'zweimal richtig', count: rightTwice },
    {
      kind: 'right-last',
      label: 'nur zuletzt richtig',
      count: Math.max(0, last.correct - rightTwice),
    },
    wrong,
  ];
};

// A round other than the open one that has unanswered cards was given up
// when a newer round started.
export const roundStatus = (round: RoundScore, open: boolean): string => {
  if (round.completed) {
    return `${scoreText(round)} (${scorePercent(round)} %)`;
  }
  const progress = `${round.answered} von ${round.total} beantwortet`;
  return open ? `läuft · ${progress}` : `abgebrochen · ${progress}`;
};

// What practising the missed cards covers: their words, in the one
// direction they share or in all of theirs.
export const missedPracticeSearch = (missed: ReadonlyArray<MissedCard>) => {
  const directions = new Set<AnswerDirection>(
    missed.map((card) => card.direction),
  );
  const [only] = directions;
  return {
    entries: [...new Set(missed.map((card) => card.entryId))].join(','),
    direction: directions.size === 1 && only !== undefined ? only : 'both',
  } as const;
};

export type PickableEntry = {
  readonly id: string;
  readonly bookId: string;
  readonly bookName: string;
  readonly unitId: string | null;
  readonly unitName: string | null;
  readonly targetText: string;
  readonly nativeText: string;
};

export type EntryGroup = {
  readonly key: string;
  readonly label: string;
  readonly entries: ReadonlyArray<PickableEntry>;
};

// One group per unit, and one per book for the words that live directly in
// it, in the order the entries come in.
export const entryGroups = (
  entries: ReadonlyArray<PickableEntry>,
): ReadonlyArray<EntryGroup> => {
  const groups = new Map<
    string,
    { label: string; entries: Array<PickableEntry> }
  >();
  for (const entry of entries) {
    const key = entry.unitId ?? `book:${entry.bookId}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, {
        label:
          entry.unitName === null
            ? entry.bookName
            : `${entry.bookName} · ${entry.unitName}`,
        entries: [entry],
      });
    } else {
      group.entries.push(entry);
    }
  }
  return [...groups].map(([key, group]) => ({ key, ...group }));
};

// The server's own messages are written for the learner; anything without
// one fell over on the way.
export const failureText = (cause: unknown, fallback: string): string =>
  cause instanceof Error && cause.message.trim() !== ''
    ? cause.message
    : fallback;
