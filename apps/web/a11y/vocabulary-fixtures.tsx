import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';
import { VocabularyExample } from '../src/features/courses/ui/vocabulary-example';
import { VocabularyLibrary } from '../src/features/courses/ui/vocabulary-library';
import { PageLayout } from '../src/shared/ui/page-layout';
import { englishSubject } from './course-fixture-data';
import { fixtureBackControl } from './fixture-controls';
import { FixtureStudyAction } from './word-entry-fixture';

const entries: ReadonlyArray<VocabularyEntry> = [
  {
    id: '00000000-0000-0000-0000-000000000011',
    bookId: '00000000-0000-0000-0000-000000000031',
    bookName: 'Green Line 3',
    unitId: '00000000-0000-0000-0000-000000000003',
    unitName: 'Unit 3: Holidays',
    targetText: 'memory',
    nativeText: 'die Erinnerung',
    keyPoints: null,
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
      },
      {
        cardId: '00000000-0000-0000-0000-000000000022',
        direction: 'to_native',
        state: 'new',
        dueAt: null,
        introducedAt: null,
        failures: 0,
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
      },
      {
        cardId: '00000000-0000-0000-0000-000000000024',
        direction: 'to_native',
        state: 'new',
        dueAt: null,
        introducedAt: new Date('2026-08-29T08:00:00Z'),
        failures: 0,
      },
    ],
  },
];

export const VocabularyFixture = ({
  difficult = false,
}: {
  readonly difficult?: boolean;
}) => (
  <PageLayout
    backControl={fixtureBackControl('English A2', 'course')}
    title="Vokabelliste"
  >
    <p className="text-muted-foreground text-sm">
      Termine gelten pro Abfragerichtung. Wähle Vokabeln aus beliebigen
      Einheiten.
    </p>
    <VocabularyLibrary
      enabledDirections={['to_target', 'to_native']}
      entries={entries}
      initialFilter={difficult ? 'difficult' : 'all'}
      renderEntryDetail={(entry) => (
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
      )}
      renderStudyAction={(_, intent) => <FixtureStudyAction intent={intent} />}
      scope="course"
      subject={englishSubject}
    />
  </PageLayout>
);
