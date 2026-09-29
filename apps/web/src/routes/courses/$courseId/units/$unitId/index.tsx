import { createFileRoute } from '@tanstack/react-router';
import {
  getCourseDirections,
  getCourseOutline,
  listCourseVocabulary,
} from '../../../../../features/courses/services/server-fns';
import { progressSummary } from '../../../../../features/courses/ui/progress-status';
import { getCourse } from '../../../../../features/import/server-fns';
import { courseNouns } from '../../../../../shared/directions';
import { BackLink } from '../../../../../shared/ui/back-link';
import { PageLayout } from '../../../../../shared/ui/page-layout';
import { cardClass } from '../../../../../shared/ui/surface-styles';
import { PlaceDirectionPlan, PlaceWords } from '../../-place-screen';

// One screen per unit: progress, the unit's actions, and its vocabulary as a
// selectable list — no separate filtered Vokabelliste to jump to.
const UnitScreen = () => {
  const { book, course, courseEntries, directions, unit, unitEntries } =
    Route.useLoaderData();
  const backControl =
    book === undefined ? (
      <BackLink params={{ courseId: course.id }} to="/courses/$courseId">
        {course.name}
      </BackLink>
    ) : (
      <BackLink
        params={{ courseId: course.id, bookId: book.id }}
        to="/courses/$courseId/books/$bookId"
      >
        {book.name}
      </BackLink>
    );

  if (unit === undefined) {
    return (
      <PageLayout backControl={backControl} title={course.name}>
        <p className={`${cardClass} font-medium`}>
          Diese Einheit gehört nicht zu{' '}
          {course.kind === 'terms' ? 'diesem Fach' : 'dieser Sprache'}.
        </p>
      </PageLayout>
    );
  }

  const place = { bookId: unit.bookId, unitId: unit.id };
  const summary = progressSummary(unit, courseNouns(course));
  return (
    <PageLayout backControl={backControl} title={unit.name}>
      <p className="text-muted-foreground text-sm">
        {book === undefined ? summary : `${book.name} · ${summary}`}
      </p>
      {unit.directions.length === 0 ? null : (
        <PlaceDirectionPlan
          courseId={course.id}
          place={place}
          progress={unit}
          subject={course}
        />
      )}
      <PlaceWords
        course={course}
        courseEntries={courseEntries}
        enabledDirections={directions}
        entries={unitEntries}
        place={place}
      />
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/units/$unitId/')({
  // The unit comes from the course's own list, which is what confirms it
  // belongs to this course before its entries are read.
  loader: async ({ params }) => {
    const [course, outline, directions, entries] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseOutline({ data: params.courseId }),
      getCourseDirections({ data: params.courseId }),
      listCourseVocabulary({ data: params.courseId }),
    ]);
    const unit = outline.units.find(
      (candidate) => candidate.id === params.unitId,
    );
    return {
      book: outline.books.find((candidate) => candidate.id === unit?.bookId),
      course,
      courseEntries: entries,
      directions,
      unit,
      unitEntries: entries.filter((entry) => entry.unitId === params.unitId),
    };
  },
  component: UnitScreen,
});
