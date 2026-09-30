import type {
  CourseOutline,
  VocabularyEntry,
  WordProgress,
} from '../src/features/courses/schemas/course-units';
import { CourseOverview } from '../src/features/courses/ui/course-overview';
import { DirectionPlan } from '../src/features/courses/ui/direction-plan';
import { listItemNameClass } from '../src/features/courses/ui/list-item-name-styles';
import { progressSummary } from '../src/features/courses/ui/progress-status';
import { QuickEntry } from '../src/features/courses/ui/quick-entry';
import { directionLabel } from '../src/shared/directions';
import { countNoun } from '../src/shared/format/count';
import { itemsInNextSection } from '../src/shared/session/section-policy';
import { PageLayout } from '../src/shared/ui/page-layout';
import {
  courseOutline,
  currentBook,
  dueUnit,
  emptyUnit,
  englishSubject,
  type FixtureWord,
  fixtureEntry,
  mixedUnit,
  novelBook,
  novelEntries,
  unintroducedUnit,
} from './course-fixture-data';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';
import {
  FixtureNewVocabularyForm,
  FixturePlaceVocabulary,
} from './word-entry-fixture';
import { useFixtureEntries } from './word-entry-fixture-data';

const coursePrimaryAction = (
  emptyVocabulary: boolean,
  practiceAvailable: boolean,
) => {
  if (emptyVocabulary) {
    return fixtureControl('Seite fotografieren', 'import', 'primary');
  }
  return practiceAvailable
    ? fixtureControl('6 Karten üben', 'practice', 'primary')
    : fixtureControl(
        '2 Vokabeln kennenlernen · Englisch → Deutsch',
        'learn',
        'primary',
      );
};

type CourseFixtureProps = {
  readonly emptyVocabulary?: boolean;
  readonly practiceAvailable?: boolean;
  readonly withoutBooks?: boolean;
};

const fixtureOutline = ({
  emptyVocabulary,
  withoutBooks,
}: CourseFixtureProps): CourseOutline => {
  if (withoutBooks === true) {
    return { books: [], units: [] };
  }
  return emptyVocabulary === true
    ? { books: [currentBook], units: [emptyUnit] }
    : courseOutline;
};

// Whatever name is typed, the flow opens the one new book the fixtures have.
const openNewBook = () => {
  navigateToFixture('book-new');
  return Promise.resolve();
};

export const CourseFixture = ({
  emptyVocabulary = false,
  practiceAvailable = true,
  withoutBooks = false,
}: CourseFixtureProps) => {
  const outline = fixtureOutline({ emptyVocabulary, withoutBooks });
  const noVocabulary = emptyVocabulary || withoutBooks;
  const { entries, createEntry } = useFixtureEntries(
    noVocabulary ? [] : novelEntries,
  );
  const { books, units } = outline;
  return (
    <PageLayout
      backControl={fixtureBackControl('Übersicht', 'dashboard')}
      title="English A2"
    >
      <CourseOverview
        createBook={openNewBook}
        importAction={
          noVocabulary
            ? null
            : fixtureControl('Seite fotografieren', 'import', 'quiet')
        }
        languageLabel="Englisch"
        outline={outline}
        primaryAction={coursePrimaryAction(noVocabulary, practiceAvailable)}
        quickEntry={
          books.length === 0 ? null : (
            <QuickEntry
              outline={outline}
              renderForm={(place) => (
                <FixtureNewVocabularyForm
                  createEntry={(draft) =>
                    createEntry(
                      draft,
                      books.find((book) => book.id === place.bookId) ??
                        currentBook,
                      units.find((unit) => unit.id === place.unitId) ?? null,
                    )
                  }
                  entries={entries}
                />
              )}
            />
          )
        }
        renderBookLink={(book) => (
          <button
            className={listItemNameClass}
            onClick={() =>
              navigateToFixture(
                book.id === novelBook.id ? 'book-novel' : 'book',
              )
            }
            type="button"
          >
            {book.name}
          </button>
        )}
        settingsAction={fixtureControl(
          'Einstellungen',
          'course-settings',
          'quiet',
        )}
        vocabularyAction={fixtureControl('Vokabelliste', 'vocabulary', 'quiet')}
      />
    </PageLayout>
  );
};

// A book's or unit's learning paths, with its actions as fixture controls.
export const FixtureDirectionPlan = ({
  progress,
}: {
  readonly progress: WordProgress;
}) => (
  <DirectionPlan
    progress={progress}
    renderLearnAction={(direction, variant) =>
      fixtureControl(
        `${countNoun(itemsInNextSection(direction.unintroduced), 'Vokabel', 'Vokabeln')} kennenlernen${variant === 'primary' ? ` · ${directionLabel(direction.direction, englishSubject)}` : ''}`,
        'learn',
        variant,
      )
    }
    renderScheduledAction={(direction, variant) =>
      fixtureControl(
        `${countNoun(direction.due + direction.firstReviews, 'Karte', 'Karten')} üben · ${directionLabel(direction.direction, englishSubject)}`,
        'practice',
        variant,
      )
    }
    subject={englishSubject}
  />
);

type UnitFixtureProps = {
  readonly state?: 'mixed' | 'unintroduced' | 'due' | 'empty';
};

const unitsByState = {
  mixed: mixedUnit,
  unintroduced: unintroducedUnit,
  due: dueUnit,
  empty: emptyUnit,
} as const;

const unitEntry = (index: number, word: FixtureWord): VocabularyEntry =>
  fixtureEntry(index, word, currentBook, mixedUnit);

const entriesByState: Record<
  NonNullable<UnitFixtureProps['state']>,
  ReadonlyArray<VocabularyEntry>
> = {
  mixed: [
    unitEntry(1, ['memory', 'die Erinnerung', true]),
    unitEntry(2, ['holiday', 'die Ferien', false]),
  ],
  unintroduced: Array.from({ length: unintroducedUnit.entries }, (_, index) =>
    unitEntry(index + 1, [
      `new word ${index + 1}`,
      `neues Wort ${index + 1}`,
      false,
    ]),
  ),
  due: [unitEntry(1, ['memory', 'die Erinnerung', true])],
  empty: [],
};

// One unit screen holds both learning paths and its selectable vocabulary.
export const UnitFixture = ({ state = 'mixed' }: UnitFixtureProps) => {
  const unit = unitsByState[state];
  return (
    <PageLayout
      backControl={fixtureBackControl(currentBook.name, 'book')}
      title={unit.name}
    >
      <p className="text-muted-foreground text-sm">
        {`${currentBook.name} · ${progressSummary(unit)}`}
      </p>
      {unit.directions.length === 0 ? null : (
        <FixtureDirectionPlan progress={unit} />
      )}
      <FixturePlaceVocabulary
        book={currentBook}
        initialEntries={entriesByState[state]}
        unit={unit}
      />
    </PageLayout>
  );
};
