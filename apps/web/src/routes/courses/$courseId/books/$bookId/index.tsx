import { createFileRoute, Link } from '@tanstack/react-router';
import { useId } from 'react';
import type { CourseUnit } from '../../../../../features/courses/schemas/course-units';
import {
  getCourseDirections,
  getCourseOutline,
  listCourseVocabulary,
} from '../../../../../features/courses/services/server-fns';
import { placeLinkClass } from '../../../../../features/courses/ui/place-link-styles';
import { bookSummary } from '../../../../../features/courses/ui/progress-status';
import { UnitList } from '../../../../../features/courses/ui/unit-list';
import { getCourse } from '../../../../../features/import/server-fns';
import { germanLabels } from '../../../../../shared/languages';
import { ActionLink } from '../../../../../shared/ui/action-link';
import { BackLink } from '../../../../../shared/ui/back-link';
import { PageLayout } from '../../../../../shared/ui/page-layout';
import { cardClass } from '../../../../../shared/ui/surface-styles';
import { PlaceDirectionPlan, PlaceWords } from '../../-place-screen';

type BookUnitsProps = {
  readonly courseId: string;
  readonly units: ReadonlyArray<CourseUnit>;
  // A book without words of its own offers the photo import here instead.
  readonly offerImport: boolean;
};

const BookUnits = ({ courseId, units, offerImport }: BookUnitsProps) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl" id={headingId}>
          Einheiten
        </h2>
        {offerImport ? (
          <ActionLink
            params={{ courseId }}
            to="/courses/$courseId/import"
            variant="quiet"
          >
            Seite fotografieren
          </ActionLink>
        ) : null}
      </div>
      <UnitList
        renderUnitLink={(unit) => (
          <Link
            className={placeLinkClass}
            params={{ courseId, unitId: unit.id }}
            to="/courses/$courseId/units/$unitId"
          >
            {unit.name}
          </Link>
        )}
        units={units}
      />
    </section>
  );
};

// One screen per book: the words that live directly in it, like a novel's,
// followed by its units, like a textbook's. A book with units but no words of
// its own shows only the units.
const BookScreen = () => {
  const { book, course, courseEntries, directions, entries, units } =
    Route.useLoaderData();
  const backControl = (
    <BackLink params={{ courseId: course.id }} to="/courses/$courseId">
      {course.name}
    </BackLink>
  );

  if (book === undefined) {
    return (
      <PageLayout backControl={backControl} title={course.name}>
        <p className={`${cardClass} font-medium`}>
          Dieses Buch gehört nicht zu diesem Kurs.
        </p>
      </PageLayout>
    );
  }

  const targetLabel = germanLabels[course.targetLanguage];
  const place = { bookId: book.id, unitId: null };
  const showWords = book.entries > 0 || units.length === 0;
  return (
    <PageLayout backControl={backControl} title={book.name}>
      <p className="text-muted-foreground text-sm">
        {bookSummary(book, units)}
      </p>
      {book.entries === 0 || book.directions.length === 0 ? null : (
        <PlaceDirectionPlan
          courseId={course.id}
          place={place}
          progress={book}
          targetLabel={targetLabel}
        />
      )}
      {showWords ? (
        <PlaceWords
          courseEntries={courseEntries}
          courseId={course.id}
          enabledDirections={directions}
          entries={entries}
          place={place}
          targetLabel={targetLabel}
          targetLanguage={course.targetLanguage}
        />
      ) : null}
      {units.length === 0 ? null : (
        <BookUnits
          courseId={course.id}
          offerImport={!showWords}
          units={units}
        />
      )}
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/books/$bookId/')({
  // The book comes from the course's own list, which is what confirms it
  // belongs to this course before its entries are read.
  loader: async ({ params }) => {
    const [course, outline, directions, entries] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseOutline({ data: params.courseId }),
      getCourseDirections({ data: params.courseId }),
      listCourseVocabulary({ data: params.courseId }),
    ]);
    return {
      book: outline.books.find((candidate) => candidate.id === params.bookId),
      course,
      courseEntries: entries,
      directions,
      entries: entries.filter(
        (entry) => entry.bookId === params.bookId && entry.unitId === null,
      ),
      units: outline.units.filter((unit) => unit.bookId === params.bookId),
    };
  },
  component: BookScreen,
});
