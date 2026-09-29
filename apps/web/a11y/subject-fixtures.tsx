import { useState } from 'react';
import type {
  CourseBook,
  CourseUnit,
  VocabularyEntry,
} from '../src/features/courses/schemas/course-units';
import { EditableBook } from '../src/features/courses/ui/book-editor';
import { CourseOverview } from '../src/features/courses/ui/course-overview';
import { NewTermForm } from '../src/features/courses/ui/new-term-form';
import { placeLinkClass } from '../src/features/courses/ui/place-link-styles';
import { PlaceVocabulary } from '../src/features/courses/ui/place-vocabulary';
import { bookSummary } from '../src/features/courses/ui/progress-status';
import { QuickEntry } from '../src/features/courses/ui/quick-entry';
import { SubjectSettings } from '../src/features/courses/ui/subject-settings';
import type { TermDraft } from '../src/features/courses/ui/term-definition-fields';
import { TermKeyPoints } from '../src/features/courses/ui/term-key-points';
import { VocabularyLibrary } from '../src/features/courses/ui/vocabulary-library';
import { courseNouns } from '../src/shared/directions';
import { Button } from '../src/shared/ui/button';
import { PageLayout } from '../src/shared/ui/page-layout';
import { termsSubject } from './course-fixture-data';
import { FixtureDirectionPlan } from './course-fixtures';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';
import {
  emptySubjectOutline,
  fixtureDefinition,
  fixtureKeyPoints,
  generalBook,
  subjectEntries,
  subjectName,
  subjectOutline,
  termEntry,
} from './subject-fixture-data';

const nouns = courseNouns(termsSubject);
const courseBack = fixtureBackControl(subjectName, 'terms-course');

// Typed terms join the list in memory, without key points, the way the
// server stores them before deriving the points.
const useFixtureTerms = (initial: ReadonlyArray<VocabularyEntry>) => {
  const [entries, setEntries] = useState(initial);
  const createEntry = (
    { term, definition }: TermDraft,
    book: CourseBook,
    unit: CourseUnit | null,
  ) => {
    setEntries((current) => [
      ...current,
      termEntry(
        current.length + 1,
        { term, definition, keyPoints: null, introduced: false, failures: 0 },
        book,
        unit,
      ),
    ]);
    return Promise.resolve();
  };
  return { entries, createEntry };
};

type FixtureNewTermFormProps = {
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly createEntry: (draft: TermDraft) => Promise<void>;
};

const FixtureNewTermForm = ({
  entries,
  createEntry,
}: FixtureNewTermFormProps) => (
  <NewTermForm
    createEntry={createEntry}
    entries={entries}
    suggestDefinition={fixtureDefinition}
  />
);

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

// A new subject has only its book "Allgemein", so the page opens with the
// entry form.
export const SubjectCourseFixture = ({
  empty = false,
}: {
  readonly empty?: boolean;
}) => {
  const outline = empty ? emptySubjectOutline : subjectOutline;
  const { entries, createEntry } = useFixtureTerms(empty ? [] : subjectEntries);
  return (
    <PageLayout
      backControl={fixtureBackControl('Übersicht', 'dashboard-subjects')}
      title={subjectName}
    >
      <CourseOverview
        createBook={() => Promise.resolve()}
        importAction={null}
        languageLabel={null}
        outline={outline}
        primaryAction={
          empty
            ? null
            : fixtureControl('1 Karte üben', 'terms-practice', 'primary')
        }
        quickEntry={
          <QuickEntry
            outline={outline}
            renderForm={(place) => (
              <FixtureNewTermForm
                createEntry={(draft) =>
                  createEntry(
                    draft,
                    outline.books.find((book) => book.id === place.bookId) ??
                      generalBook,
                    outline.units.find((unit) => unit.id === place.unitId) ??
                      null,
                  )
                }
                entries={entries}
              />
            )}
          />
        }
        renderBookLink={(book) => (
          <button
            className={placeLinkClass}
            onClick={() => navigateToFixture('terms-book')}
            type="button"
          >
            {book.name}
          </button>
        )}
        settingsAction={fixtureControl(
          'Einstellungen',
          'terms-settings',
          'quiet',
        )}
        subject={termsSubject}
        vocabularyAction={fixtureControl(
          nouns.list,
          'terms-vocabulary',
          'quiet',
        )}
      />
    </PageLayout>
  );
};

// The book "Allgemein" with its own terms, each with its key points or the
// offer to derive them.
export const SubjectBookFixture = () => {
  const { entries, createEntry } = useFixtureTerms(
    subjectEntries.filter((entry) => entry.bookId === generalBook.id),
  );
  const [book, setBook] = useState(generalBook);
  return (
    <PageLayout backControl={courseBack} title={book.name}>
      <EditableBook
        book={book}
        books={subjectOutline.books}
        createUnit={() => Promise.resolve([])}
        renameBook={(name) => {
          setBook((current) => ({ ...current, name }));
          return Promise.resolve();
        }}
        reorderUnits={() => Promise.resolve([])}
        subject={termsSubject}
        summary={bookSummary(book, [], nouns)}
        units={[]}
      >
        <FixtureDirectionPlan progress={book} subject={termsSubject} />
        <PlaceVocabulary
          enabledDirections={['to_native']}
          entries={entries}
          entryForm={
            <FixtureNewTermForm
              createEntry={(draft) => createEntry(draft, book, null)}
              entries={entries}
            />
          }
          importAction={null}
          place="book"
          renderEntryDetail={(entry) => <FixtureTermKeyPoints entry={entry} />}
          renderStudyAction={termsStudyAction}
          subject={termsSubject}
        />
      </EditableBook>
    </PageLayout>
  );
};

export const SubjectVocabularyFixture = () => (
  <PageLayout backControl={courseBack} title={nouns.list}>
    <p className="text-muted-foreground text-sm">
      Wähle beliebige Begriffe aus und übe genau diese Auswahl.
    </p>
    <VocabularyLibrary
      enabledDirections={['to_native']}
      entries={subjectEntries}
      initialFilter="all"
      renderEntryDetail={(entry) => <FixtureTermKeyPoints entry={entry} />}
      renderStudyAction={termsStudyAction}
      scope="course"
      subject={termsSubject}
    />
  </PageLayout>
);

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
