import type {
  CourseBook,
  CourseUnit,
  VocabularyEntry,
} from '../src/features/courses/schemas/course-units';
import type { CreatedVocabularyEntry } from '../src/features/courses/services/vocabulary-entry-service';
import { NewVocabularyForm } from '../src/features/courses/ui/new-vocabulary-form';
import { PlaceVocabulary } from '../src/features/courses/ui/place-vocabulary';
import type { NewVocabularyEntryDraft } from '../src/features/courses/ui/use-new-vocabulary-entry';
import { VocabularyExample } from '../src/features/courses/ui/vocabulary-example';
import { Button } from '../src/shared/ui/button';
import { englishSubject, targetLabel } from './course-fixture-data';
import { fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';
import {
  fixtureDraftExample,
  fixtureExampleTranslation,
  fixtureTranslation,
  useFixtureEntries,
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

// Starts learning or practicing the selected words.
export const FixtureStudyAction = ({
  intent,
}: {
  readonly intent: 'learn' | 'practice';
}) => (
  <Button
    onClick={() =>
      navigateToFixture(intent === 'learn' ? 'learn-start' : 'study-start')
    }
  >
    Auswahl {intent === 'learn' ? 'kennenlernen' : 'üben'}
  </Button>
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
  const { entries, createEntry } = useFixtureEntries(initialEntries);
  return (
    <PlaceVocabulary
      enabledDirections={['to_target', 'to_native']}
      entries={entries}
      entryForm={
        <FixtureNewVocabularyForm
          createEntry={(draft) => createEntry(draft, book, unit)}
          entries={entries}
        />
      }
      importAction={fixtureControl('Seite fotografieren', 'import', 'primary')}
      place={unit === null ? 'book' : 'unit'}
      renderEntryDetail={(entry) => <FixtureVocabularyExample entry={entry} />}
      renderStudyAction={(_, intent) => <FixtureStudyAction intent={intent} />}
      subject={englishSubject}
    />
  );
};
