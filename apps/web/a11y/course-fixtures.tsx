import { useRef } from 'react';
import type {
  CourseOutline,
  VocabularyEntry,
  WordProgress,
} from '../src/features/courses/schemas/course-units';
import { CourseOverview } from '../src/features/courses/ui/course-overview';
import { DirectionPlan } from '../src/features/courses/ui/direction-plan';
import { placeLinkClass } from '../src/features/courses/ui/place-link-styles';
import { progressSummary } from '../src/features/courses/ui/progress-status';
import { QuickVocabularyEntry } from '../src/features/courses/ui/quick-vocabulary-entry';
import { directionLabel } from '../src/shared/directions';
import { countNoun } from '../src/shared/format/count';
import { itemsInNextSection } from '../src/shared/session/section-policy';
import { PageLayout } from '../src/shared/ui/page-layout';
import {
  courseOutline,
  currentBook,
  dueUnit,
  emptyUnit,
  type FixtureWord,
  fixtureEntry,
  mixedUnit,
  novelBook,
  novelEntries,
  noWords,
  targetLabel,
  unintroducedUnit,
} from './course-fixture-data';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';
import { FixturePlaceVocabulary } from './word-entry-fixture';
import {
  fixtureDraftExample,
  fixtureExampleTranslation,
  fixtureTranslation,
  useFixtureEntries,
} from './word-entry-fixture-data';

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

const initialOutline = ({
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

// Book and unit edits change an in-memory outline, the way the server returns
// the course's new outline after each change.
const useFixtureOutline = (props: CourseFixtureProps) => {
  const outlineRef = useRef(initialOutline(props));
  const update = (
    change: (current: CourseOutline) => CourseOutline,
  ): Promise<CourseOutline> => {
    outlineRef.current = change(outlineRef.current);
    return Promise.resolve(outlineRef.current);
  };
  return {
    outline: outlineRef.current,
    createBook: (name: string) =>
      update((current) => ({
        ...current,
        books: [
          ...current.books,
          { ...noWords, id: crypto.randomUUID(), name },
        ],
      })),
    renameBook: (bookId: string, name: string) =>
      update((current) => ({
        ...current,
        books: current.books.map((book) =>
          book.id === bookId ? { ...book, name } : book,
        ),
      })),
    createUnit: (bookId: string, name: string) =>
      update((current) => ({
        ...current,
        units: [
          ...current.units,
          { ...emptyUnit, bookId, id: crypto.randomUUID(), name },
        ],
      })),
    reorderUnits: (
      bookId: string,
      _expectedUnitIds: ReadonlyArray<string>,
      unitIds: ReadonlyArray<string>,
    ) =>
      update((current) => ({
        ...current,
        units: [
          ...current.units.filter((unit) => unit.bookId !== bookId),
          ...unitIds.flatMap((unitId) =>
            current.units.filter((unit) => unit.id === unitId),
          ),
        ],
      })),
  };
};

export const CourseFixture = ({
  emptyVocabulary = false,
  practiceAvailable = true,
  withoutBooks = false,
}: CourseFixtureProps) => {
  const outline = useFixtureOutline({ emptyVocabulary, withoutBooks });
  const noVocabulary = emptyVocabulary || withoutBooks;
  const { entries, createEntry } = useFixtureEntries(
    noVocabulary ? [] : novelEntries,
  );
  const { books, units } = outline.outline;
  return (
    <PageLayout
      backControl={fixtureBackControl('Übersicht', 'dashboard')}
      title="English A2"
    >
      <CourseOverview
        {...outline}
        importAction={
          noVocabulary
            ? null
            : fixtureControl('Seite fotografieren', 'import', 'quiet')
        }
        languageLabel="Englisch"
        primaryAction={coursePrimaryAction(noVocabulary, practiceAvailable)}
        quickEntry={
          books.length === 0 ? null : (
            <QuickVocabularyEntry
              createEntry={(place, draft) =>
                createEntry(
                  draft,
                  books.find((book) => book.id === place.bookId) ?? currentBook,
                  units.find((unit) => unit.id === place.unitId) ?? null,
                )
              }
              entries={entries}
              generateExample={fixtureDraftExample}
              outline={outline.outline}
              suggestTranslation={(_, text, given) =>
                fixtureTranslation(text, given)
              }
              targetLabel={targetLabel}
              targetLanguage="en"
              translateExample={fixtureExampleTranslation}
            />
          )
        }
        renderBookLink={(book) => (
          <button
            className={placeLinkClass}
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
        `${countNoun(itemsInNextSection(direction.unintroduced), 'Vokabel', 'Vokabeln')} kennenlernen${variant === 'primary' ? ` · ${directionLabel(direction.direction, targetLabel)}` : ''}`,
        'learn',
        variant,
      )
    }
    renderScheduledAction={(direction, variant) =>
      fixtureControl(
        `${countNoun(direction.due + direction.firstReviews, 'Karte', 'Karten')} üben · ${directionLabel(direction.direction, targetLabel)}`,
        'practice',
        variant,
      )
    }
    targetLabel={targetLabel}
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
