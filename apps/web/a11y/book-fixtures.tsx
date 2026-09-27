import { useId } from 'react';
import { placeLinkClass } from '../src/features/courses/ui/place-link-styles';
import { bookSummary } from '../src/features/courses/ui/progress-status';
import { UnitList } from '../src/features/courses/ui/unit-list';
import { PageLayout } from '../src/shared/ui/page-layout';
import {
  courseOutline,
  currentBook,
  novelBook,
  novelEntries,
} from './course-fixture-data';
import { FixtureDirectionPlan } from './course-fixtures';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';
import { FixturePlaceVocabulary } from './word-entry-fixture';

type BookFixtureProps = {
  // A textbook files its words in units; a novel keeps them in the book.
  readonly kind: 'textbook' | 'novel';
};

// The book page as its route renders it: the book's own words, then its
// units. A book with units but no words of its own shows only the units.
export const BookFixture = ({ kind }: BookFixtureProps) => {
  const unitsHeadingId = useId();
  const book = kind === 'novel' ? novelBook : currentBook;
  const entries = kind === 'novel' ? novelEntries : [];
  const units = courseOutline.units.filter((unit) => unit.bookId === book.id);
  const showWords = book.entries > 0 || units.length === 0;
  return (
    <PageLayout
      backControl={fixtureBackControl('English A2', 'course')}
      title={book.name}
    >
      <p className="text-muted-foreground text-sm">
        {bookSummary(book, units)}
      </p>
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
                className={placeLinkClass}
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
    </PageLayout>
  );
};
