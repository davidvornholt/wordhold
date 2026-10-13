import type {
  CourseBook,
  CourseUnit,
  VocabularyEntry,
} from '../src/features/courses/schemas/course-units';
import type { CreatedVocabularyEntry } from '../src/features/courses/services/vocabulary-entry-service';
import { NewVocabularyForm } from '../src/features/courses/ui/new-vocabulary-form';
import { PlaceVocabulary } from '../src/features/courses/ui/place-vocabulary';
import type { StudyAction } from '../src/features/courses/ui/study-action';
import type { NewVocabularyEntryDraft } from '../src/features/courses/ui/use-new-vocabulary-entry';
import { VocabularyExample } from '../src/features/courses/ui/vocabulary-example';
import { Button } from '../src/shared/ui/button';
import { englishSubject, targetLabel } from './course-fixture-data';
import { fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';
import { useFixtureWords } from './fixture-word-actions';
import {
  fixtureDraftExample,
  fixtureExampleTranslation,
  fixtureTranslation,
} from './word-entry-fixture-data';

type FixtureNewVocabularyFormProps = {
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly createEntry: (
    draft: NewVocabularyEntryDraft,
  ) => Promise<CreatedVocabularyEntry>;
};

// The English course's entry form, with suggestions answered in memory.
export const FixtureNewVocabularyForm = ({
  entries,
  createEntry,
}: FixtureNewVocabularyFormProps) => (
  <NewVocabularyForm
    createEntry={createEntry}
    entries={entries}
    generateExample={fixtureDraftExample}
    suggestTranslation={fixtureTranslation}
    targetLabel={targetLabel}
    targetLanguage="en"
    translateExample={fixtureExampleTranslation}
  />
);

// A word's example sentence, generated on request.
export const FixtureVocabularyExample = ({
  entry,
}: {
  readonly entry: VocabularyEntry;
}) => (
  <VocabularyExample
    entry={entry}
    generate={() =>
      Promise.resolve({
        targetText: 'This is a useful example.',
        nativeText: 'Das ist ein hilfreiches Beispiel.',
        source: 'generated',
      })
    }
    targetLanguage="en"
  />
);

// Starts learning or practicing the selected words, as the routes do.
export const FixtureStudyAction = ({
  action,
}: {
  readonly action: StudyAction;
}) => (
  <>
    <Button
      onClick={() =>
        navigateToFixture(
          action.intent === 'learn' ? 'learn-start' : 'study-start',
        )
      }
      variant={action.primary ? 'primary' : 'outline'}
    >
      Auswahl {action.intent === 'learn' ? 'kennenlernen' : 'üben'}
    </Button>
    {action.intent === 'practice' ? (
      <Button
        onClick={() => navigateToFixture('sentence-practice')}
        variant="outline"
      >
        Sätze übersetzen
      </Button>
    ) : null}
  </>
);

type FixturePlaceVocabularyProps = {
  readonly book: CourseBook;
  readonly unit: CourseUnit | null;
  readonly initialEntries: ReadonlyArray<VocabularyEntry>;
};

// The word list of a unit, or of a book's own words, as its page shows it.
export const FixturePlaceVocabulary = ({
  book,
  unit,
  initialEntries,
}: FixturePlaceVocabularyProps) => {
  const { entries, createEntry, entryActions } = useFixtureWords(
    initialEntries,
    (entry) => <FixtureVocabularyExample entry={entry} />,
  );
  return (
    <PlaceVocabulary
      enabledDirections={['to_target', 'to_native']}
      entries={entries}
      entryActions={entryActions}
      entryForm={
        <FixtureNewVocabularyForm
          createEntry={(draft) => createEntry(draft, book, unit)}
          entries={entries}
        />
      }
      importAction={fixtureControl('Seite fotografieren', 'import', 'primary')}
      initialFilter="all"
      place={unit === null ? 'book' : 'unit'}
      renderStudyAction={(action) => <FixtureStudyAction action={action} />}
      subject={englishSubject}
    />
  );
};
