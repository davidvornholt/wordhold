import { useState } from 'react';
import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';
import { NewTermForm } from '../src/features/courses/ui/new-term-form';
import { SubjectOverview } from '../src/features/courses/ui/subject-overview';
import { SubjectSettings } from '../src/features/courses/ui/subject-settings';
import type { TermDraft } from '../src/features/courses/ui/term-definition-fields';
import { TermKeyPoints } from '../src/features/courses/ui/term-key-points';
import { Button } from '../src/shared/ui/button';
import { PageLayout } from '../src/shared/ui/page-layout';
import { termsSubject } from './course-fixture-data';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';
import {
  fixtureDefinition,
  fixtureKeyPoints,
  subjectEntries,
  subjectName,
  termEntry,
} from './subject-fixture-data';

// Typed terms join the list in memory, without key points, the way the
// server stores them before deriving the points.
const useFixtureTerms = (initial: ReadonlyArray<VocabularyEntry>) => {
  const [entries, setEntries] = useState(initial);
  const createEntry = ({ term, definition }: TermDraft) => {
    setEntries((current) => [
      ...current,
      termEntry(current.length + 1, {
        term,
        definition,
        keyPoints: null,
        introduced: false,
        failures: 0,
      }),
    ]);
    return Promise.resolve();
  };
  return { entries, createEntry };
};

const FixtureTermKeyPoints = ({
  entry,
}: {
  readonly entry: VocabularyEntry;
}) => (
  <TermKeyPoints
    derive={() => fixtureKeyPoints(entry)}
    keyPoints={entry.keyPoints}
    update={(keyPoints) => Promise.resolve({ keyPoints })}
  />
);

const termsStudyAction = (
  _entryIds: ReadonlyArray<string>,
  intent: 'learn' | 'practice',
) => (
  <Button
    onClick={() =>
      navigateToFixture(intent === 'learn' ? 'terms-learn' : 'terms-practice')
    }
  >
    Auswahl {intent === 'learn' ? 'kennenlernen' : 'üben'}
  </Button>
);

// A subject's page is its list of terms. A new subject opens with the entry
// form.
export const SubjectCourseFixture = ({
  empty = false,
}: {
  readonly empty?: boolean;
}) => {
  const { entries, createEntry } = useFixtureTerms(empty ? [] : subjectEntries);
  return (
    <PageLayout
      backControl={fixtureBackControl('Übersicht', 'dashboard-subjects')}
      title={subjectName}
    >
      <SubjectOverview
        enabledDirections={['to_native']}
        entries={entries}
        entryForm={
          <NewTermForm
            createEntry={createEntry}
            entries={entries}
            suggestDefinition={fixtureDefinition}
          />
        }
        initialFilter="all"
        primaryAction={
          empty
            ? null
            : fixtureControl('1 Karte üben', 'terms-practice', 'primary')
        }
        renderEntryDetail={(entry) => <FixtureTermKeyPoints entry={entry} />}
        renderStudyAction={termsStudyAction}
        settingsAction={fixtureControl(
          'Einstellungen',
          'terms-settings',
          'quiet',
        )}
        subject={termsSubject}
      />
    </PageLayout>
  );
};

const subjectId = '00000000-0000-0000-0000-000000000006';
const overviewCourses = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'English A2' },
  { id: subjectId, name: subjectName },
];

export const SubjectSettingsFixture = () => {
  const [name, setName] = useState(subjectName);
  return (
    <PageLayout
      backControl={fixtureBackControl(name, 'terms-course')}
      title={`${name}: Einstellungen`}
    >
      <SubjectSettings
        courseId={subjectId}
        courses={overviewCourses}
        name={name}
        rename={(next) => {
          setName(next);
          return Promise.resolve();
        }}
      />
    </PageLayout>
  );
};
