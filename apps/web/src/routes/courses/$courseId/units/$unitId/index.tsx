import { createFileRoute, Link } from '@tanstack/react-router';
import { introducedEntries } from '../../../../../features/courses/schemas/course-units';
import {
  listCourseUnits,
  listUnitEntries,
} from '../../../../../features/courses/services/server-fns';
import { CourseLayout } from '../../../../../features/courses/ui/course-layout';
import { UnitDetail } from '../../../../../features/courses/ui/unit-detail';
import { getCourse } from '../../../../../features/import/server-fns';

const UnitScreen = () => {
  const { course, unit, entries } = Route.useLoaderData();
  const backControl = (
    <Link
      className="text-muted-foreground text-sm underline"
      params={{ courseId: course.id }}
      to="/courses/$courseId"
    >
      ← {course.name}
    </Link>
  );

  if (unit === undefined) {
    return (
      <CourseLayout backControl={backControl} title={course.name}>
        <p className="border border-border bg-card p-6 font-medium">
          Diese Einheit gehört nicht zu diesem Kurs.
        </p>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout backControl={backControl} title={unit.name}>
      <UnitDetail
        practiceAction={
          <Link
            className="inline-flex min-h-11 items-center bg-primary px-4 py-2 font-medium text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            params={{ courseId: course.id }}
            search={{ unit: unit.id }}
            to="/courses/$courseId/study"
          >
            {introducedEntries(unit)} Vokabeln üben
          </Link>
        }
        learnAction={
          <Link
            className="font-medium text-sm underline"
            params={{ courseId: course.id, unitId: unit.id }}
            to="/courses/$courseId/units/$unitId/learn"
          >
            {unit.unintroduced} kennenlernen
          </Link>
        }
        targetLanguage={course.targetLanguage}
        unit={unit}
        entries={entries}
      />
    </CourseLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/units/$unitId/')({
  // The unit comes from the course's own list, which is what confirms it
  // belongs to this course before its entries are read.
  loader: async ({ params }) => {
    const [course, units] = await Promise.all([
      getCourse({ data: params.courseId }),
      listCourseUnits({ data: params.courseId }),
    ]);
    const unit = units.find((candidate) => candidate.id === params.unitId);
    const entries =
      unit === undefined ? [] : await listUnitEntries({ data: unit.id });
    return { course, unit, entries };
  },
  component: UnitScreen,
});
