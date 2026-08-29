import { createFileRoute, Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { listCourseUnits } from '../../../features/courses/services/server-fns';
import { CourseLayout } from '../../../features/courses/ui/course-layout';
import { CourseOverview } from '../../../features/courses/ui/course-overview';
import { hasAvailablePractice } from '../../../features/dashboard/schemas/dashboard-models';
import { getDashboard } from '../../../features/dashboard/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import { languageSubtitle } from '../../../shared/languages';

const CourseScreen = () => {
  const { course, units, stats } = Route.useLoaderData();
  const nextUnit = units.find((unit) => unit.unintroduced > 0);
  let primaryAction: ReactNode = null;
  if (hasAvailablePractice(stats)) {
    primaryAction = (
      <Link
        className="inline-flex min-h-11 items-center bg-primary px-4 py-2 font-medium text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        params={{ courseId: course.id }}
        to="/courses/$courseId/practice"
      >
        {stats?.ready ?? 0} Karten üben
      </Link>
    );
  } else if (nextUnit !== undefined) {
    primaryAction = (
      <Link
        className="inline-flex min-h-11 items-center bg-primary px-4 py-2 font-medium text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        params={{ courseId: course.id, unitId: nextUnit.id }}
        to="/courses/$courseId/units/$unitId/learn"
      >
        {nextUnit.unintroduced} Vokabeln kennenlernen
      </Link>
    );
  }

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
        primaryAction={primaryAction}
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
        vocabularyAction={
          <Link
            className="min-h-11 content-center text-sm underline underline-offset-4"
            params={{ courseId: course.id }}
            search={{ filter: 'all' }}
            to="/courses/$courseId/vocabulary"
          >
            Vokabelliste
          </Link>
        }
        units={units}
      />
    </CourseLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/')({
  loader: async ({ params }) => {
    const [course, units, dashboard] = await Promise.all([
      getCourse({ data: params.courseId }),
      listCourseUnits({ data: params.courseId }),
      getDashboard(),
    ]);
    return {
      course,
      units,
      stats: dashboard.perCourse.find((stats) => stats.courseId === course.id),
    };
  },
  component: CourseScreen,
});
