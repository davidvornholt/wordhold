import { useRef } from 'react';
import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';
import type { VocabularyFilter } from '../src/features/courses/schemas/vocabulary-search';
import { VocabularyExample } from '../src/features/courses/ui/vocabulary-example';
import { VocabularyLibrary } from '../src/features/courses/ui/vocabulary-library';
import { PageLayout } from '../src/shared/ui/page-layout';
import { englishSubject } from './course-fixture-data';
import { fixtureBackControl } from './fixture-controls';
import type { FixtureState } from './fixture-state';
import { useFixtureWords } from './fixture-word-actions';
import { adolescentEntryId } from './pitfall-fixture-data';
import { FixtureStudyAction } from './word-entry-fixture';

const storedEntries: ReadonlyArray<VocabularyEntry> = [
  {
    id: '00000000-0000-0000-0000-000000000011',
    bookId: '00000000-0000-0000-0000-000000000031',
    bookName: 'Green Line 3',
    unitId: '00000000-0000-0000-0000-000000000003',
    unitName: 'Unit 3: Holidays',
    targetText: 'memory',
    nativeText: 'die Erinnerung',
    keyPoints: null,
    spellingPitfalls: [],
    synonyms: null,
    antonyms: null,
    example: {
      targetText: 'That trip is a happy memory.',
      nativeText: 'Diese Reise ist eine schöne Erinnerung.',
      source: 'textbook',
    },
    introduced: true,
    cards: [
      {
        cardId: '00000000-0000-0000-0000-000000000021',
        direction: 'to_target',
        state: 'review',
        dueAt: new Date('2026-08-28T10:00:00Z'),
        introducedAt: new Date('2026-08-20T10:00:00Z'),
        failures: 2,
        hardAnswers: 0,
      },
      {
        cardId: '00000000-0000-0000-0000-000000000022',
        direction: 'to_native',
        state: 'new',
        dueAt: null,
        introducedAt: null,
        failures: 0,
        hardAnswers: 0,
      },
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    bookId: '00000000-0000-0000-0000-000000000031',
    bookName: 'Green Line 3',
    unitId: '00000000-0000-0000-0000-000000000004',
    unitName: 'Unit 4: Sport',
    targetText: 'the referee',
    nativeText: 'der Schiedsrichter',
    keyPoints: null,
    spellingPitfalls: null,
    synonyms: null,
    antonyms: null,
    example: null,
    introduced: true,
    cards: [
      {
        cardId: '00000000-0000-0000-0000-000000000023',
        direction: 'to_target',
        state: 'new',
        dueAt: null,
        introducedAt: new Date('2026-08-29T08:00:00Z'),
        failures: 0,
        hardAnswers: 0,
      },
      {
        cardId: '00000000-0000-0000-0000-000000000024',
        direction: 'to_native',
        state: 'new',
        dueAt: null,
        introducedAt: new Date('2026-08-29T08:00:00Z'),
        failures: 0,
        hardAnswers: 0,
      },
    ],
  },
];

// A word of a course that practises synonyms and opposites, not learned yet
// in either direction, so its synonyms and opposites wait for it.
const relatedEntry: VocabularyEntry = {
  id: '00000000-0000-0000-0000-000000000013',
  bookId: '00000000-0000-0000-0000-000000000031',
  bookName: 'Green Line 3',
  unitId: '00000000-0000-0000-0000-000000000003',
  unitName: 'Unit 3: Holidays',
  targetText: 'happy',
  nativeText: 'glücklich',
  keyPoints: null,
  spellingPitfalls: null,
  synonyms: ['glad', 'cheerful'],
  antonyms: ['sad'],
  example: null,
  introduced: false,
  cards: [
    {
      cardId: '00000000-0000-0000-0000-000000000025',
      direction: 'to_target',
      state: 'new',
      dueAt: null,
      introducedAt: null,
      failures: 0,
      hardAnswers: 0,
    },
    {
      cardId: '00000000-0000-0000-0000-000000000026',
      direction: 'to_native',
      state: 'new',
      dueAt: null,
      introducedAt: null,
      failures: 0,
      hardAnswers: 0,
    },
    {
      cardId: '00000000-0000-0000-0000-000000000027',
      direction: 'to_synonym',
      state: 'new',
      dueAt: null,
      introducedAt: null,
      failures: 0,
      hardAnswers: 0,
    },
    {
      cardId: '00000000-0000-0000-0000-000000000028',
      direction: 'to_antonym',
      state: 'new',
      dueAt: null,
      introducedAt: null,
      failures: 0,
      hardAnswers: 0,
    },
  ],
};

// Right only just once, and often misspelled, though its pitfall is still to
// be found. Listed before memory, which was not known twice, so sorting by
// difficulty shows.
const adolescentEntry: VocabularyEntry = {
  id: adolescentEntryId,
  bookId: '00000000-0000-0000-0000-000000000031',
  bookName: 'Green Line 3',
  unitId: '00000000-0000-0000-0000-000000000003',
  unitName: 'Unit 3: Holidays',
  targetText: 'adolescent',
  nativeText: 'der/die Jugendliche',
  keyPoints: null,
  spellingPitfalls: null,
  synonyms: null,
  antonyms: null,
  example: null,
  introduced: true,
  cards: [
    {
      cardId: '00000000-0000-0000-0000-000000000029',
      direction: 'to_target',
      state: 'review',
      dueAt: new Date('2026-09-04T10:00:00Z'),
      introducedAt: new Date('2026-08-20T10:00:00Z'),
      failures: 0,
      hardAnswers: 1,
    },
    {
      cardId: '00000000-0000-0000-0000-000000000030',
      direction: 'to_native',
      state: 'review',
      dueAt: new Date('2026-09-10T10:00:00Z'),
      introducedAt: new Date('2026-08-20T10:00:00Z'),
      failures: 0,
      hardAnswers: 0,
    },
  ],
};

const FixtureExample = ({ entry }: { readonly entry: VocabularyEntry }) => (
  <VocabularyExample
    entry={entry}
    generate={() =>
      Promise.resolve({
        targetText: 'The referee stopped the match.',
        nativeText: 'Der Schiedsrichter unterbrach das Spiel.',
        source: 'generated',
      })
    }
    targetLanguage="en"
  />
);

const fixtureFilters: Partial<Record<FixtureState, VocabularyFilter>> = {
  'vocabulary-difficult': 'difficult',
  'vocabulary-pitfalls': 'pitfalls',
};

// The course practises synonyms and opposites too with vocabulary-related.
const fixtureEntries = (
  state: FixtureState,
): ReadonlyArray<VocabularyEntry> => {
  if (state === 'vocabulary-related') {
    return [...storedEntries, relatedEntry];
  }
  return state === 'vocabulary'
    ? storedEntries
    : [adolescentEntry, ...storedEntries];
};

export const VocabularyFixture = ({
  state,
}: {
  readonly state: FixtureState;
}) => {
  const related = state === 'vocabulary-related';
  const { entries, entryActions } = useFixtureWords(
    fixtureEntries(state),
    (entry) => <FixtureExample entry={entry} />,
  );
  const introRef = useRef<HTMLParagraphElement>(null);
  return (
    <PageLayout
      backControl={fixtureBackControl('English A2', 'course')}
      title="Vokabelliste"
    >
      <p
        className="text-muted-foreground text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        ref={introRef}
        tabIndex={-1}
      >
        Termine gelten pro Abfragerichtung. Wähle Vokabeln aus beliebigen
        Einheiten.
      </p>
      <VocabularyLibrary
        enabledDirections={
          related
            ? ['to_target', 'to_native', 'to_synonym', 'to_antonym']
            : ['to_target', 'to_native']
        }
        entries={entries}
        entryActions={entryActions}
        fallbackFocusRef={introRef}
        initialFilter={fixtureFilters[state] ?? 'all'}
        layout="by-place"
        renderStudyAction={(action) => <FixtureStudyAction action={action} />}
        subject={englishSubject}
      />
    </PageLayout>
  );
};
