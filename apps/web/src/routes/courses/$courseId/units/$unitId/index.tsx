import { createFileRoute, Link } from '@tanstack/react-router';
import { learnedWords } from '../../../../../features/courses/schemas/course-units';
import {
  listCourseUnits,
  listUnitWords,
} from '../../../../../features/courses/services/server-fns';
import { CourseLayout } from '../../../../../features/courses/ui/course-layout';
import { UnitDetail } from '../../../../../features/courses/ui/unit-detail';
import { getCourse } from '../../../../../features/import/server-fns';

const UnitScreen = () => {
  const { course, unit, words } = Route.useLoaderData();
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
        drillAction={
          <Link
            className="font-medium text-sm underline"
            params={{ courseId: course.id, unitId: unit.id }}
            to="/courses/$courseId/units/$unitId/drill"
          >
            {learnedWords(unit)} üben
          </Link>
        }
        learnAction={
          <Link
            className="font-medium text-sm underline"
            params={{ courseId: course.id, unitId: unit.id }}
            to="/courses/$courseId/units/$unitId/learn"
          >
            {unit.unlearned} lernen
          </Link>
        }
        targetLanguage={course.targetLanguage}
        unit={unit}
        words={words}
      />
    </CourseLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/units/$unitId/')({
  // The unit comes from the course's own list, which is what confirms it
  // belongs to this course before its words are read.
  loader: async ({ params }) => {
    const [course, units] = await Promise.all([
      getCourse({ data: params.courseId }),
      listCourseUnits({ data: params.courseId }),
    ]);
    const unit = units.find((candidate) => candidate.id === params.unitId);
    const words =
      unit === undefined ? [] : await listUnitWords({ data: unit.id });
    return { course, unit, words };
  },
  component: UnitScreen,
});
