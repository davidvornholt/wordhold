import { createFileRoute, Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { listCourseUnits } from '../../../features/courses/services/server-fns';
import { CourseOverview } from '../../../features/courses/ui/course-overview';
import { hasAvailablePractice } from '../../../features/dashboard/schemas/dashboard-models';
import { getDashboard } from '../../../features/dashboard/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import { countNoun } from '../../../shared/format/count';
import { languageSubtitle } from '../../../shared/languages';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';
import { PageLayout } from '../../../shared/ui/page-layout';

const CourseScreen = () => {
  const { course, units, stats } = Route.useLoaderData();
  const nextUnit = units.find((unit) => unit.unintroduced > 0);
  const isEmpty = units.length === 0;
  let primaryAction: ReactNode = null;
  if (hasAvailablePractice(stats)) {
    primaryAction = (
      <ActionLink
        params={{ courseId: course.id }}
        to="/courses/$courseId/practice"
      >
        {countNoun(stats?.ready ?? 0, 'Karte', 'Karten')} üben
      </ActionLink>
    );
  } else if (nextUnit !== undefined) {
    primaryAction = (
      <ActionLink
        params={{ courseId: course.id, unitId: nextUnit.id }}
        to="/courses/$courseId/units/$unitId/learn"
      >
        {countNoun(nextUnit.unintroduced, 'Vokabel', 'Vokabeln')} kennenlernen
      </ActionLink>
    );
  } else if (isEmpty) {
    primaryAction = (
      <ActionLink
        params={{ courseId: course.id }}
        to="/courses/$courseId/import"
      >
        Seite fotografieren
      </ActionLink>
    );
  }

  return (
    <PageLayout
      backControl={<BackLink to="/">Übersicht</BackLink>}
      title={course.name}
    >
      <CourseOverview
        importAction={
          isEmpty ? null : (
            <ActionLink
              params={{ courseId: course.id }}
              to="/courses/$courseId/import"
              variant="quiet"
            >
              Seite fotografieren
            </ActionLink>
          )
        }
        languageLabel={languageSubtitle(course.name, course.targetLanguage)}
        primaryAction={primaryAction}
        renderUnitLink={(unit) => (
          <Link
            className="w-fit font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            params={{ courseId: course.id, unitId: unit.id }}
            to="/courses/$courseId/units/$unitId"
          >
            {unit.name}
          </Link>
        )}
        settingsAction={
          <ActionLink
            params={{ courseId: course.id }}
            to="/courses/$courseId/settings"
            variant="quiet"
          >
            Einstellungen
          </ActionLink>
        }
        vocabularyAction={
          <ActionLink
            params={{ courseId: course.id }}
            search={{ filter: 'all' }}
            to="/courses/$courseId/vocabulary"
            variant="quiet"
          >
            Vokabelliste
          </ActionLink>
        }
        units={units}
      />
    </PageLayout>
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
