import type {
  CourseBook,
  CourseOutline,
  CourseUnit,
  DirectionProgress,
  VocabularyEntry,
  WordProgress,
} from '../src/features/courses/schemas/course-units';
import type { CourseSubject } from '../src/shared/directions';

export const targetLabel = 'Englisch';

export const englishSubject: CourseSubject = {
  kind: 'language',
  targetLanguage: 'en',
};

export const termsSubject: CourseSubject = {
  kind: 'terms',
  targetLanguage: 'de',
};

export const textsSubject: CourseSubject = {
  kind: 'texts',
  targetLanguage: 'de',
};

const holidaysCount = 18;
const holidaysReverseIntroduced = 16;
const sportCount = 25;
const schoolCount = 16;
const novelCount = 12;
const novelReverseIntroduced = 7;

export const noWords: WordProgress = {
  entries: 0,
  introduced: 0,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  lastAddedAt: null,
  directions: [],
};

// The textbooks are filed in units. The earlier one is there to revisit; the
// learner works through the later one.
export const earlierBook: CourseBook = {
  ...noWords,
  id: '00000000-0000-0000-0000-000000000011',
  name: 'Green Line 2',
};

export const currentBook: CourseBook = {
  ...noWords,
  id: '00000000-0000-0000-0000-000000000012',
  name: 'Green Line 3',
};

const directionProgress = (
  direction: DirectionProgress['direction'],
  total: number,
  introduced: number,
  overrides: Partial<DirectionProgress> = {},
): DirectionProgress => ({
  direction,
  total,
  introduced,
  unintroduced: total - introduced,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  ...overrides,
});

export const mixedUnit: CourseUnit = {
  bookId: currentBook.id,
  id: '00000000-0000-0000-0000-000000000003',
  name: 'Unit 3 – Holidays',
  entries: holidaysCount,
  introduced: holidaysCount,
  unintroduced: 2,
  due: 0,
  firstReviews: 0,
  nextDueAt: new Date('2026-09-01T10:40:00Z'),
  lastAddedAt: new Date('2026-08-28T18:00:00Z'),
  directions: [
    directionProgress('to_target', holidaysCount, holidaysCount),
    directionProgress('to_native', holidaysCount, holidaysReverseIntroduced),
  ],
};

export const unintroducedUnit: CourseUnit = {
  bookId: currentBook.id,
  id: '00000000-0000-0000-0000-000000000004',
  name: 'Unit 4 – Sport',
  entries: sportCount,
  introduced: 0,
  unintroduced: sportCount,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  lastAddedAt: new Date('2026-08-29T18:00:00Z'),
  directions: [
    directionProgress('to_target', sportCount, 0),
    directionProgress('to_native', sportCount, 0),
  ],
};

export const finishedUnit: CourseUnit = {
  bookId: earlierBook.id,
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Unit 2 – School',
  entries: schoolCount,
  introduced: schoolCount,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: new Date('2026-09-01T10:40:00Z'),
  lastAddedAt: new Date('2026-06-12T18:00:00Z'),
  directions: [
    directionProgress('to_target', schoolCount, schoolCount),
    directionProgress('to_native', schoolCount, schoolCount),
  ],
};

export const dueUnit: CourseUnit = {
  ...finishedUnit,
  bookId: currentBook.id,
  id: '00000000-0000-0000-0000-000000000006',
  name: 'Unit 6 – Travel',
  due: 1,
  nextDueAt: null,
  directions: [
    directionProgress('to_target', schoolCount, schoolCount, { due: 1 }),
    directionProgress('to_native', schoolCount, schoolCount),
  ],
};

export const emptyUnit: CourseUnit = {
  ...noWords,
  bookId: currentBook.id,
  id: '00000000-0000-0000-0000-000000000005',
  name: 'Unit 5 – Empty',
};

// A novel keeps its words directly in the book. It received the latest word,
// so typing a new one starts there.
export const novelBook: CourseBook = {
  id: '00000000-0000-0000-0000-000000000013',
  name: 'The Hobbit',
  entries: novelCount,
  introduced: novelCount,
  unintroduced: novelCount - novelReverseIntroduced,
  due: 0,
  firstReviews: 0,
  nextDueAt: new Date('2026-09-02T09:00:00Z'),
  lastAddedAt: new Date('2026-08-31T21:00:00Z'),
  directions: [
    directionProgress('to_target', novelCount, novelCount),
    directionProgress('to_native', novelCount, novelReverseIntroduced),
  ],
};

// The book the course page opens after "Neues Buch": no words or units yet.
export const newBook: CourseBook = {
  ...noWords,
  id: '00000000-0000-0000-0000-000000000014',
  name: 'Harry Potter',
};

export const courseOutline: CourseOutline = {
  books: [earlierBook, currentBook, novelBook],
  units: [finishedUnit, mixedUnit, unintroducedUnit, emptyUnit],
};

const uuidTailLength = 12;
const entryIdOffset = 100;
const cardIdOffset = 200;

const fixtureId = (offset: number, index: number): string =>
  `00000000-0000-4000-8000-${String(offset + index).padStart(uuidTailLength, '0')}`;

export type FixtureWord = readonly [
  target: string,
  native: string,
  introduced: boolean,
];

// A stored word in a unit, or directly in a book when no unit is given.
export const fixtureEntry = (
  index: number,
  [target, native, introduced]: FixtureWord,
  book: CourseBook,
  unit: CourseUnit | null,
): VocabularyEntry => ({
  id: fixtureId(entryIdOffset, index),
  bookId: book.id,
  bookName: book.name,
  unitId: unit?.id ?? null,
  unitName: unit?.name ?? null,
  targetText: target,
  nativeText: native,
  keyPoints: null,
  synonyms: null,
  antonyms: null,
  example: null,
  introduced,
  cards: [
    {
      cardId: fixtureId(cardIdOffset, index),
      direction: 'to_target',
      state: introduced ? 'review' : 'new',
      dueAt: introduced ? new Date('2026-08-28T10:00:00Z') : null,
      introducedAt: introduced ? new Date('2026-08-20T10:00:00Z') : null,
      failures: 0,
    },
  ],
});

const novelWords: ReadonlyArray<FixtureWord> = [
  ['burglar', 'der Einbrecher', true],
  ['hobbit-hole', 'die Hobbithöhle', true],
  ['riddle', 'das Rätsel', true],
  ['to dwindle', 'schwinden', false],
];

export const novelEntries = novelWords.map((word, index) =>
  fixtureEntry(index + 1, word, novelBook, null),
);
