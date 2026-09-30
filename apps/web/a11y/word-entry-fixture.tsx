import type {
  CourseBook,
  CourseUnit,
  VocabularyEntry,
} from '../src/features/courses/schemas/course-units';
import { PlaceVocabulary } from '../src/features/courses/ui/place-vocabulary';
import { Button } from '../src/shared/ui/button';
import { englishSubject } from './course-fixture-data';
import { fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';
import {
  fixtureDraftExample,
  fixtureExampleTranslation,
  fixtureTranslation,
  useFixtureEntries,
} from './word-entry-fixture-data';

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
      courseEntries={entries}
      createEntry={(draft) => createEntry(draft, book, unit)}
      enabledDirections={['to_target', 'to_native']}
      entries={entries}
      generateDraftExample={fixtureDraftExample}
      generateExample={async () => ({
        targetText: 'This is a useful example.',
        nativeText: 'Das ist ein hilfreiches Beispiel.',
        source: 'generated',
      })}
      importAction={fixtureControl('Seite fotografieren', 'import', 'primary')}
      place={unit === null ? 'book' : 'unit'}
      renderStudyAction={(_, intent) => (
        <Button
          onClick={() =>
            navigateToFixture(
              intent === 'learn' ? 'learn-start' : 'study-start',
            )
          }
        >
          Auswahl {intent === 'learn' ? 'kennenlernen' : 'üben'}
        </Button>
      )}
      suggestTranslation={fixtureTranslation}
      subject={englishSubject}
      translateDraftExample={fixtureExampleTranslation}
    />
  );
};
