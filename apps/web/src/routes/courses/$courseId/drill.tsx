import { createFileRoute, Link } from '@tanstack/react-router';
import { learnedWords } from '../../../features/courses/schemas/course-units';
import { listCourseUnits } from '../../../features/courses/services/server-fns';
import { UnitList } from '../../../features/courses/ui/unit-list';
import { getCourse } from '../../../features/import/server-fns';
import { PracticeLayout } from '../../../features/practice/ui/practice-layout';

const DrillUnitsScreen = () => {
  const { course, units } = Route.useLoaderData();

  return (
    <PracticeLayout
      backControl={
        <Link className="text-muted-foreground text-sm underline" to="/">
          ← Übersicht
        </Link>
      }
      title={`${course.name}: Einheit üben`}
    >
      <p className="text-muted-foreground text-sm">
        Für die Arbeit morgen. Eine Einheit am Stück, unabhängig davon, was
        heute fällig wäre. Wörter, die noch nicht dran waren, behalten dabei
        ihren Termin.
      </p>
      <UnitList
        importAction={
          <Link
            className="w-fit text-sm underline"
            params={{ courseId: course.id }}
            to="/courses/$courseId/import"
          >
            Seite fotografieren
          </Link>
        }
        renderAction={(unit) =>
          learnedWords(unit) === 0 ? null : (
            <Link
              className="whitespace-nowrap font-medium text-sm underline"
              params={{ courseId: course.id, unitId: unit.id }}
              to="/courses/$courseId/units/$unitId/drill"
            >
              {learnedWords(unit)} üben
            </Link>
          )
        }
        units={units}
      />
    </PracticeLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/drill')({
  loader: async ({ params }) => {
    const [course, units] = await Promise.all([
      getCourse({ data: params.courseId }),
      listCourseUnits({ data: params.courseId }),
    ]);
    return { course, units };
  },
  component: DrillUnitsScreen,
});
