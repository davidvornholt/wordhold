import { createFileRoute, Link } from '@tanstack/react-router';
import { listCourseUnits } from '../../../features/courses/services/server-fns';
import { CourseLayout } from '../../../features/courses/ui/course-layout';
import { CourseOverview } from '../../../features/courses/ui/course-overview';
import { getCourse } from '../../../features/import/server-fns';
import { languageSubtitle } from '../../../shared/languages';

const CourseScreen = () => {
  const { course, units } = Route.useLoaderData();

  return (
    <CourseLayout
      backControl={
        <Link className="text-muted-foreground text-sm underline" to="/">
          ← Übersicht
        </Link>
      }
      title={course.name}
    >
      <CourseOverview
        importAction={
          <Link
            className="text-sm underline"
            params={{ courseId: course.id }}
            to="/courses/$courseId/import"
          >
            Seite fotografieren
          </Link>
        }
        languageLabel={languageSubtitle(course.name, course.targetLanguage)}
        practiceAction={
          <Link
            className="font-medium text-sm underline"
            params={{ courseId: course.id }}
            to="/courses/$courseId/practice"
          >
            Üben
          </Link>
        }
        renderUnitLink={(unit) => (
          <Link
            className="w-fit font-medium underline"
            params={{ courseId: course.id, unitId: unit.id }}
            to="/courses/$courseId/units/$unitId"
          >
            {unit.name}
          </Link>
        )}
        settingsAction={
          <Link
            className="text-sm underline"
            params={{ courseId: course.id }}
            to="/courses/$courseId/settings"
          >
            Einstellungen
          </Link>
        }
        units={units}
      />
    </CourseLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/')({
  loader: async ({ params }) => {
    const [course, units] = await Promise.all([
      getCourse({ data: params.courseId }),
      listCourseUnits({ data: params.courseId }),
    ]);
    return { course, units };
  },
  component: CourseScreen,
});
