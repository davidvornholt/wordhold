import { useId, useRef, useState } from 'react';
import type {
  CourseBook,
  CourseUnit,
} from '../src/features/courses/schemas/course-units';
import { EditableBook } from '../src/features/courses/ui/book-editor';
import { listItemNameClass } from '../src/features/courses/ui/list-item-name-styles';
import { bookSummary } from '../src/features/courses/ui/progress-status';
import { UnitList } from '../src/features/courses/ui/unit-list';
import { PageLayout } from '../src/shared/ui/page-layout';
import {
  courseOutline,
  currentBook,
  emptyUnit,
  newBook,
  novelBook,
  novelEntries,
} from './course-fixture-data';
import { FixtureDirectionPlan } from './course-fixtures';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';
import { FixturePlaceVocabulary } from './word-entry-fixture';

type BookKind = 'textbook' | 'novel' | 'new';

type BookFixtureProps = {
  // A textbook files its words in units; a novel keeps them in the book; a
  // new book has neither yet.
  readonly kind: BookKind;
};

const fixtureBooks: Record<BookKind, CourseBook> = {
  new: newBook,
  novel: novelBook,
  textbook: currentBook,
};

// Renaming and unit edits change the book in memory, the way the server
// returns the book's units in their saved order after each change.
const useFixtureBook = (kind: BookKind) => {
  const [book, setBook] = useState(fixtureBooks[kind]);
  const unitsRef = useRef<ReadonlyArray<CourseUnit>>(
    courseOutline.units.filter((unit) => unit.bookId === book.id),
  );
  const [units, setUnits] = useState(unitsRef.current);
  const changeUnits = (
    change: (current: ReadonlyArray<CourseUnit>) => ReadonlyArray<CourseUnit>,
  ) => {
    unitsRef.current = change(unitsRef.current);
    setUnits(unitsRef.current);
    return Promise.resolve(unitsRef.current);
  };
  return {
    book,
    units,
    renameBook: (name: string) => {
      setBook((current) => ({ ...current, name }));
      return Promise.resolve();
    },
    createUnit: (name: string) =>
      changeUnits((current) => [
        ...current,
        { ...emptyUnit, bookId: book.id, id: crypto.randomUUID(), name },
      ]),
    reorderUnits: (
      _expectedUnitIds: ReadonlyArray<string>,
      unitIds: ReadonlyArray<string>,
    ) =>
      changeUnits((current) =>
        unitIds.flatMap((unitId) =>
          current.filter((unit) => unit.id === unitId),
        ),
      ),
  };
};

// The book page as its route renders it: the book's own words, then its
// units. A book with units but no words of its own shows only the units.
export const BookFixture = ({ kind }: BookFixtureProps) => {
  const unitsHeadingId = useId();
  const { book, units, ...edits } = useFixtureBook(kind);
  const entries = kind === 'novel' ? novelEntries : [];
  const showWords = book.entries > 0 || units.length === 0;
  return (
    <PageLayout
      backControl={fixtureBackControl('English A2', 'course')}
      title={book.name}
    >
      <EditableBook
        book={book}
        books={courseOutline.books}
        summary={bookSummary(book, units)}
        units={units}
        {...edits}
      >
        {book.entries === 0 ? null : <FixtureDirectionPlan progress={book} />}
        {showWords ? (
          <FixturePlaceVocabulary
            book={book}
            initialEntries={entries}
            unit={null}
          />
        ) : null}
        {units.length === 0 ? null : (
          <section
            aria-labelledby={unitsHeadingId}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-xl" id={unitsHeadingId}>
                Einheiten
              </h2>
              {showWords
                ? null
                : fixtureControl('Seite fotografieren', 'import', 'quiet')}
            </div>
            <UnitList
              renderUnitLink={(unit) => (
                <button
                  className={listItemNameClass}
                  onClick={() => navigateToFixture('unit')}
                  type="button"
                >
                  {unit.name}
                </button>
              )}
              units={units}
            />
          </section>
        )}
      </EditableBook>
    </PageLayout>
  );
};
