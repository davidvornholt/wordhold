import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';

export const subjectName = 'Chemie';

const uuidTailLength = 12;
const entryIdOffset = 300;
const cardIdOffset = 400;

const fixtureId = (offset: number, index: number): string =>
  `00000000-0000-4000-8000-${String(offset + index).padStart(uuidTailLength, '0')}`;

// The book every subject keeps its terms in, which its page never shows.
const subjectBook = {
  id: '00000000-0000-0000-0000-000000000061',
  name: 'Allgemein',
};

type FixtureTerm = {
  readonly term: string;
  readonly definition: string;
  // Null while the key points have not been derived yet.
  readonly keyPoints: ReadonlyArray<string> | null;
  readonly introduced: boolean;
  readonly failures: number;
};

// A stored term. A term is only asked from term to definition, so it has one
// card.
export const termEntry = (
  index: number,
  { term, definition, keyPoints, introduced, failures }: FixtureTerm,
): VocabularyEntry => ({
  id: fixtureId(entryIdOffset, index),
  bookId: subjectBook.id,
  bookName: subjectBook.name,
  unitId: null,
  unitName: null,
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

const storedTerms: ReadonlyArray<FixtureTerm> = [
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
  {
    term: 'Enzym',
    definition:
      'Ein Protein, das als Biokatalysator eine bestimmte Reaktion im Körper beschleunigt.',
    keyPoints: null,
    introduced: false,
    failures: 0,
  },
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
];

export const subjectEntries = storedTerms.map((stored, index) =>
  termEntry(index + 1, stored),
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
