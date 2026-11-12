import type {
  ExamDetail,
  ExamSummary,
  MissedCard,
  RoundScore,
} from '../src/features/exams/schemas/exam-models';
import type { PickableEntry } from '../src/features/exams/ui/exam-figures';
import {
  currentBook,
  mixedUnit,
  novelBook,
  unintroducedUnit,
} from './course-fixture-data';

const fixtureId = (index: number): string =>
  `00000000-0000-0000-0000-${String(500 + index).padStart(12, '0')}`;

const pickable = (
  index: number,
  targetText: string,
  nativeText: string,
  unit: { readonly id: string; readonly name: string } | null,
): PickableEntry => {
  const book = unit === null ? novelBook : currentBook;
  return {
    id: fixtureId(index),
    bookId: book.id,
    bookName: book.name,
    unitId: unit?.id ?? null,
    unitName: unit?.name ?? null,
    targetText,
    nativeText,
  };
};

const beach = pickable(4, 'beach', 'der Strand', mixedUnit);
const toWin = pickable(6, 'to win', 'gewinnen', unintroducedUnit);
const coach = pickable(7, 'coach', 'der Trainer', unintroducedUnit);

// Two units of the current book and a word of the novel's own.
export const courseEntries: ReadonlyArray<PickableEntry> = [
  pickable(1, 'memory', 'die Erinnerung', mixedUnit),
  pickable(2, 'holiday', 'die Ferien', mixedUnit),
  pickable(3, 'suitcase', 'der Koffer', mixedUnit),
  beach,
  pickable(5, 'match', 'das Spiel', unintroducedUnit),
  toWin,
  coach,
  pickable(8, 'burglar', 'der Einbrecher', null),
];

// The two units' seven words, asked both ways round.
const examEntries = courseEntries.filter((entry) => entry.unitId !== null);
const learnedCards = 12;

const round = (
  index: number,
  day: number,
  answered: number,
  correct: number,
): RoundScore => ({
  id: fixtureId(100 + index),
  startedAt: new Date(`2026-11-${String(day).padStart(2, '0')}T15:00:00Z`),
  total: learnedCards,
  answered,
  correct,
  completed: answered === learnedCards,
});

const openingRound = round(5, 4, 12, 5);
const firstRound = round(1, 6, 12, 7);
const givenUpRound = round(2, 8, 5, 4);
const secondRound = round(3, 9, 12, 10);
const openRound = round(4, 11, 4, 3);

const baseExam = {
  id: fixtureId(200),
  courseId: '00000000-0000-0000-0000-000000000001',
  name: 'Vokabeltest Unit 3 und 4',
  directions: ['to_target', 'to_native'],
  createdAt: new Date('2026-11-03T15:00:00Z'),
  archivedAt: null,
  entryCount: examEntries.length,
} as const;

const missed = (
  index: number,
  entry: PickableEntry,
  direction: MissedCard['direction'],
): MissedCard => ({
  cardId: fixtureId(300 + index),
  entryId: entry.id,
  direction,
  targetText: entry.targetText,
  nativeText: entry.nativeText,
});

// Three finished rounds, one given up between the last two, and a fifth
// under way. One word of the second unit is not learned yet, and the course
// learns only one way round, so one of that word's cards is in a switched-off
// direction.
export const practisedExam: ExamDetail = {
  ...baseExam,
  entries: examEntries,
  cards: {
    learned: learnedCards,
    unlearned: 2,
    unlearnedEntryIds: [coach.id],
    switchedOff: 1,
  },
  rounds: [openRound, secondRound, givenUpRound, firstRound, openingRound],
  openRound,
  readiness: {
    lastRound: secondRound,
    previousRound: firstRound,
    rightTwice: 6,
    missed: [missed(1, beach, 'to_target'), missed(2, toWin, 'to_native')],
  },
};

// Just created: no round yet.
export const freshExam: ExamDetail = {
  ...practisedExam,
  rounds: [],
  openRound: null,
  readiness: {
    lastRound: null,
    previousRound: null,
    rightTwice: null,
    missed: [],
  },
};

// Written and archived, so it starts no round.
export const archivedExam: ExamDetail = {
  ...practisedExam,
  archivedAt: new Date('2026-11-12T15:00:00Z'),
  rounds: practisedExam.rounds.filter((score) => score.completed),
  openRound: null,
};

export const examSummaries: ReadonlyArray<ExamSummary> = [
  { ...baseExam, lastRound: secondRound },
  {
    ...baseExam,
    id: fixtureId(201),
    name: 'Wortschatz Holidays',
    entryCount: 4,
    lastRound: null,
  },
  {
    ...baseExam,
    id: fixtureId(202),
    name: 'Vokabeltest Unit 2',
    archivedAt: new Date('2026-10-20T15:00:00Z'),
    entryCount: 15,
    lastRound: { ...firstRound, total: 30, answered: 30, correct: 27 },
  },
];
