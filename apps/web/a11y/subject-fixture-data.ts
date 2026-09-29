import type {
  CourseBook,
  CourseOutline,
  CourseUnit,
  VocabularyEntry,
} from '../src/features/courses/schemas/course-units';
import { noWords } from './course-fixture-data';

export const subjectName = 'Chemie';

const uuidTailLength = 12;
const entryIdOffset = 300;
const cardIdOffset = 400;

const fixtureId = (offset: number, index: number): string =>
  `00000000-0000-4000-8000-${String(offset + index).padStart(uuidTailLength, '0')}`;

// Every subject starts with the book "Allgemein" for terms that belong to no
// textbook or lecture.
export const generalBook: CourseBook = {
  id: '00000000-0000-0000-0000-000000000061',
  name: 'Allgemein',
  entries: 2,
  introduced: 1,
  unintroduced: 1,
  due: 1,
  firstReviews: 0,
  nextDueAt: null,
  lastAddedAt: new Date('2026-09-02T18:00:00Z'),
  directions: [
    {
      direction: 'to_native',
      total: 2,
      introduced: 1,
      unintroduced: 1,
      due: 1,
      firstReviews: 0,
      nextDueAt: null,
    },
  ],
};

// Lecture notes filed by chapter; their terms live in the chapters.
export const lectureBook: CourseBook = {
  ...noWords,
  id: '00000000-0000-0000-0000-000000000062',
  name: 'Vorlesung Allgemeine Chemie',
};

export const atomUnit: CourseUnit = {
  bookId: lectureBook.id,
  id: '00000000-0000-0000-0000-000000000063',
  name: 'Kapitel 2 – Atombau',
  entries: 2,
  introduced: 2,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: new Date('2026-09-04T08:00:00Z'),
  lastAddedAt: new Date('2026-08-30T18:00:00Z'),
  directions: [
    {
      direction: 'to_native',
      total: 2,
      introduced: 2,
      unintroduced: 0,
      due: 0,
      firstReviews: 0,
      nextDueAt: new Date('2026-09-04T08:00:00Z'),
    },
  ],
};

export const subjectOutline: CourseOutline = {
  books: [generalBook, lectureBook],
  units: [atomUnit],
};

export const emptySubjectOutline: CourseOutline = {
  books: [{ ...generalBook, ...noWords }],
  units: [],
};

type FixtureTerm = {
  readonly term: string;
  readonly definition: string;
  // Null while the key points have not been derived yet.
  readonly keyPoints: ReadonlyArray<string> | null;
  readonly introduced: boolean;
  readonly failures: number;
};

// A stored term in a unit, or directly in a book when no unit is given. A
// term is only asked from term to definition, so it has one card.
export const termEntry = (
  index: number,
  { term, definition, keyPoints, introduced, failures }: FixtureTerm,
  book: CourseBook,
  unit: CourseUnit | null,
): VocabularyEntry => ({
  id: fixtureId(entryIdOffset, index),
  bookId: book.id,
  bookName: book.name,
  unitId: unit?.id ?? null,
  unitName: unit?.name ?? null,
  targetText: term,
  nativeText: definition,
  keyPoints,
  example: null,
  introduced,
  cards: [
    {
      cardId: fixtureId(cardIdOffset, index),
      direction: 'to_native',
      state: introduced ? 'review' : 'new',
      dueAt: introduced ? new Date('2026-09-03T08:00:00Z') : null,
      introducedAt: introduced ? new Date('2026-08-30T18:00:00Z') : null,
      failures,
    },
  ],
});

const storedTerms: ReadonlyArray<
  readonly [FixtureTerm, CourseBook, CourseUnit | null]
> = [
  [
    {
      term: 'Katalysator',
      definition:
        'Ein Stoff, der die Aktivierungsenergie einer Reaktion senkt und dabei nicht verbraucht wird.',
      keyPoints: [
        'Ein Katalysator ist ein Stoff.',
        'Er senkt die Aktivierungsenergie einer Reaktion.',
        'Er wird bei der Reaktion nicht verbraucht.',
      ],
      introduced: true,
      failures: 2,
    },
    generalBook,
    null,
  ],
  [
    {
      term: 'Enzym',
      definition:
        'Ein Protein, das als Biokatalysator eine bestimmte Reaktion im Körper beschleunigt.',
      keyPoints: null,
      introduced: false,
      failures: 0,
    },
    generalBook,
    null,
  ],
  [
    {
      term: 'Isotop',
      definition:
        'Atome desselben Elements mit gleicher Protonenzahl, aber unterschiedlicher Neutronenzahl.',
      keyPoints: [
        'Isotope sind Atome desselben Elements.',
        'Sie haben die gleiche Protonenzahl.',
        'Ihre Neutronenzahl ist unterschiedlich.',
      ],
      introduced: true,
      failures: 0,
    },
    lectureBook,
    atomUnit,
  ],
  [
    {
      term: 'Elektronegativität',
      definition:
        'Das Maß dafür, wie stark ein Atom in einer Bindung die Bindungselektronen an sich zieht.',
      keyPoints: [
        'Die Elektronegativität ist ein Maß.',
        'Sie beschreibt, wie stark ein Atom Bindungselektronen an sich zieht.',
        'Es geht um ein Atom in einer Bindung.',
      ],
      introduced: true,
      failures: 0,
    },
    lectureBook,
    atomUnit,
  ],
];

export const subjectEntries = storedTerms.map(([stored, book, unit], index) =>
  termEntry(index + 1, stored, book, unit),
);

// Suggested and derived text, answered in memory in place of the model.
export const fixtureDefinition = (term: string) =>
  Promise.resolve({
    definition:
      term === 'Oxidation'
        ? 'Eine Reaktion, bei der ein Stoff Elektronen abgibt.'
        : `Eine kurze Definition von ${term}.`,
  });

const derivedKeyPoints = new Map<string, ReadonlyArray<string>>([
  [
    'Enzym',
    [
      'Ein Enzym ist ein Protein.',
      'Es wirkt als Biokatalysator.',
      'Es beschleunigt eine bestimmte Reaktion im Körper.',
    ],
  ],
]);

export const fixtureKeyPoints = (entry: VocabularyEntry) =>
  Promise.resolve({
    keyPoints: derivedKeyPoints.get(entry.targetText) ?? [entry.nativeText],
  });
