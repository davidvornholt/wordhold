import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from '@tanstack/react-router';
import { useId } from 'react';
import type {
  CourseOutline,
  CourseUnit,
} from '../../../../../features/courses/schemas/course-units';
import {
  createCourseUnit,
  getCourseDirections,
  getCourseOutline,
  listCourseVocabulary,
  renameCourseBook,
  reorderCourseUnits,
} from '../../../../../features/courses/services/server-fns';
import { EditableBook } from '../../../../../features/courses/ui/book-editor';
import { listItemNameClass } from '../../../../../features/courses/ui/list-item-name-styles';
import { bookSummary } from '../../../../../features/courses/ui/progress-status';
import { UnitList } from '../../../../../features/courses/ui/unit-list';
import { getCourse } from '../../../../../features/import/server-fns';
import { isListCourse } from '../../../../../shared/directions';
import { ActionLink } from '../../../../../shared/ui/action-link';
import { BackLink } from '../../../../../shared/ui/back-link';
import { PageLayout } from '../../../../../shared/ui/page-layout';
import { cardClass } from '../../../../../shared/ui/surface-styles';
import {
  PlaceDirectionPlan,
  PlaceSentencePractice,
  PlaceWords,
} from '../../-place-screen';

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
            className={listItemNameClass}
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

const unitsOf = (
  outline: CourseOutline,
  bookId: string,
): ReadonlyArray<CourseUnit> =>
  outline.units.filter((unit) => unit.bookId === bookId);

// One screen per book: the words that live directly in it, like a novel's,
// followed by its units, like a textbook's. A book with units but no words of
// its own shows only the units. Editing renames the book and arranges or adds
// its units.
const BookScreen = () => {
  const { book, books, course, courseEntries, directions, entries, units } =
    Route.useLoaderData();
  const router = useRouter();
  const backControl = (
    <BackLink params={{ courseId: course.id }} to="/courses/$courseId">
      {course.name}
    </BackLink>
  );

  if (book === undefined) {
    return (
      <PageLayout backControl={backControl} title={course.name}>
        <p className={`${cardClass} font-medium`}>
          Dieses Buch gehört nicht zu dieser Sprache.
        </p>
      </PageLayout>
    );
  }

  // Each edit refreshes the loader so the title and the page behind the
  // editor match what was saved.
  const bookUnits = async (
    update: Promise<CourseOutline>,
  ): Promise<ReadonlyArray<CourseUnit>> => {
    const outline = await update;
    await router.invalidate();
    return unitsOf(outline, book.id);
  };
  const place = { courseId: course.id, bookId: book.id };
  const wordPlace = { bookId: book.id, unitId: null };
  const showWords = book.entries > 0 || units.length === 0;
  return (
    <PageLayout backControl={backControl} title={book.name}>
      <EditableBook
        book={book}
        books={books}
        createUnit={(name) =>
          bookUnits(createCourseUnit({ data: { ...place, name } }))
        }
        renameBook={async (name) => {
          await renameCourseBook({ data: { ...place, name } });
          await router.invalidate();
        }}
        reorderUnits={(expectedUnitIds, unitIds) =>
          bookUnits(
            reorderCourseUnits({
              data: { ...place, expectedUnitIds, unitIds },
            }),
          )
        }
        summary={bookSummary(book, units)}
        units={units}
      >
        {book.entries === 0 || book.directions.length === 0 ? null : (
          <PlaceDirectionPlan
            courseId={course.id}
            place={wordPlace}
            progress={book}
            subject={course}
          />
        )}
        <PlaceSentencePractice
          courseId={course.id}
          place={wordPlace}
          progress={book}
          subject={course}
        />
        {showWords ? (
          <PlaceWords
            course={course}
            courseEntries={courseEntries}
            enabledDirections={directions}
            entries={entries}
            place={wordPlace}
          />
        ) : null}
        {units.length === 0 ? null : (
          <BookUnits
            courseId={course.id}
            offerImport={!showWords}
            units={units}
          />
        )}
      </EditableBook>
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
    // A subject or collection keeps its entries in one list on its own
    // page, so it has no book pages.
    if (isListCourse(course.kind)) {
      throw redirect({
        to: '/courses/$courseId',
        params: { courseId: course.id },
      });
    }
    return {
      book: outline.books.find((candidate) => candidate.id === params.bookId),
      books: outline.books,
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
