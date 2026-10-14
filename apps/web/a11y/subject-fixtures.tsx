import { useState } from 'react';
import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';
import { EditTermForm } from '../src/features/courses/ui/edit-term-form';
import type { CourseEntryActions } from '../src/features/courses/ui/entry-actions';
import { NewTermForm } from '../src/features/courses/ui/new-term-form';
import type { StudyAction } from '../src/features/courses/ui/study-action';
import { SubjectOverview } from '../src/features/courses/ui/subject-overview';
import { SubjectSettings } from '../src/features/courses/ui/subject-settings';
import type { TermDraft } from '../src/features/courses/ui/term-definition-fields';
import { TermKeyPoints } from '../src/features/courses/ui/term-key-points';
import { withoutPitfalls } from '../src/shared/pitfalls/pitfall-model';
import { Button } from '../src/shared/ui/button';
import { PageLayout } from '../src/shared/ui/page-layout';
import { termsSubject } from './course-fixture-data';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { changeLearning } from './fixture-learning';
import { navigateToFixture } from './fixture-state';
import {
  fixtureDefinition,
  fixtureKeyPoints,
  subjectEntries,
  subjectName,
  termEntry,
} from './subject-fixture-data';

type KeyPoints = ReadonlyArray<string>;

// Typed terms join the list in memory, without key points, the way the
// server stores them before deriving the points; a corrected definition
// drops them the same way. Derived or edited key points are kept the way the
// page's refreshed loader would show them.
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
  const keepKeyPoints = (entryId: string, keyPoints: KeyPoints) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId ? { ...entry, keyPoints } : entry,
      ),
    );
    return { keyPoints };
  };
  const updateEntry = (entryId: string, { term, definition }: TermDraft) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              targetText: term,
              nativeText: definition,
              keyPoints:
                definition === entry.nativeText ? entry.keyPoints : null,
            }
          : entry,
      ),
    );
    return Promise.resolve();
  };
  const removeEntry = (entryId: string) =>
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
  const changeEntryLearning = (
    cardIds: ReadonlyArray<string>,
    change: 'skip' | 'return',
  ) => {
    const result = changeLearning(entries, cardIds, change);
    setEntries(result.entries);
    return Promise.resolve(result.changed);
  };
  return {
    entries,
    createEntry,
    keepKeyPoints,
    updateEntry,
    removeEntry,
    changeEntryLearning,
  };
};

const FixtureTermKeyPoints = ({
  entry,
  keepKeyPoints,
}: {
  readonly entry: VocabularyEntry;
  readonly keepKeyPoints: (
    entryId: string,
    keyPoints: KeyPoints,
  ) => { readonly keyPoints: KeyPoints };
}) => (
  <TermKeyPoints
    derive={async () =>
      keepKeyPoints(entry.id, (await fixtureKeyPoints(entry)).keyPoints)
    }
    keyPoints={entry.keyPoints}
    update={(keyPoints) => Promise.resolve(keepKeyPoints(entry.id, keyPoints))}
  />
);

const termsStudyAction = (action: StudyAction) => (
  <Button
    onClick={() =>
      navigateToFixture(
        action.intent === 'learn' ? 'terms-learn' : 'terms-practice',
      )
    }
    variant={action.primary ? 'primary' : 'outline'}
  >
    Auswahl {action.intent === 'learn' ? 'kennenlernen' : 'üben'}
  </Button>
);

// A subject's page is its list of terms. A new subject leads with typing its
// first term.
export const SubjectCourseFixture = ({
  empty = false,
}: {
  readonly empty?: boolean;
}) => {
  const {
    entries,
    createEntry,
    keepKeyPoints,
    updateEntry,
    removeEntry,
    changeEntryLearning,
  } = useFixtureTerms(empty ? [] : subjectEntries);
  // The list refreshes after the dialog has closed, as the page's loader
  // does.
  const entryActions: CourseEntryActions = {
    renderDetail: (entry) => (
      <FixtureTermKeyPoints entry={entry} keepKeyPoints={keepKeyPoints} />
    ),
    renderEditor: (entry, control) => (
      <EditTermForm
        control={control}
        entries={entries}
        entry={entry}
        suggestDefinition={fixtureDefinition}
        updateEntry={(draft) => updateEntry(entry.id, draft)}
      />
    ),
    remove: (entry) => {
      globalThis.setTimeout(() => removeEntry(entry.id));
      return Promise.resolve();
    },
    skipLearning: (cardIds) => changeEntryLearning(cardIds, 'skip'),
    returnToLearning: (cardIds) => changeEntryLearning(cardIds, 'return'),
    preparePitfalls: withoutPitfalls,
  };
  return (
    <PageLayout
      backControl={fixtureBackControl('Übersicht', 'dashboard-subjects')}
      title={subjectName}
    >
      <SubjectOverview
        enabledDirections={['to_native']}
        entries={entries}
        entryActions={entryActions}
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
        kind="terms"
        name={name}
        rename={(next) => {
          setName(next);
          return Promise.resolve();
        }}
      />
    </PageLayout>
  );
};
