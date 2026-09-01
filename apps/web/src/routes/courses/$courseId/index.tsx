import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import {
  courseTotals,
  recommendedUnitAction,
} from '../../../features/courses/schemas/course-units';
import {
  createCourseUnit,
  listCourseUnits,
  reorderCourseUnits,
} from '../../../features/courses/services/server-fns';
import { CourseOverview } from '../../../features/courses/ui/course-overview';
import { hasAvailablePractice } from '../../../features/dashboard/schemas/dashboard-models';
import { getDashboard } from '../../../features/dashboard/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import { directionLabel } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { germanLabels, languageSubtitle } from '../../../shared/languages';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';
import { PageLayout } from '../../../shared/ui/page-layout';

const CourseScreen = () => {
  const { course, units, stats } = Route.useLoaderData();
  const router = useRouter();
  const nextUnit = units.find((unit) => unit.unintroduced > 0);
  const isEmpty = courseTotals(units).entries === 0;
  const targetLabel = germanLabels[course.targetLanguage];
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
    const recommendation = recommendedUnitAction(nextUnit);
    const recommendedDirection =
      recommendation?.kind === 'learn'
        ? nextUnit.directions.find(
            (progress) => progress.direction === recommendation.direction,
          )
        : undefined;
    primaryAction = (
      <ActionLink
        params={{ courseId: course.id, unitId: nextUnit.id }}
        search={{ direction: recommendedDirection?.direction }}
        to="/courses/$courseId/units/$unitId/learn"
      >
        {recommendedDirection === undefined
          ? 'Neue Vokabeln kennenlernen'
          : `${countNoun(
              itemsInNextSection(recommendedDirection.unintroduced),
              'Vokabel',
              'Vokabeln',
            )} kennenlernen · ${directionLabel(
              recommendedDirection.direction,
              targetLabel,
            )}`}
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
        createUnit={async (name) => {
          const next = await createCourseUnit({
            data: { courseId: course.id, name },
          });
          await router.invalidate();
          return next;
        }}
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
            className="w-fit font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            params={{ courseId: course.id, unitId: unit.id }}
            to="/courses/$courseId/units/$unitId"
          >
            {unit.name}
          </Link>
        )}
        reorderUnits={async (expectedUnitIds, unitIds) => {
          const next = await reorderCourseUnits({
            data: { courseId: course.id, expectedUnitIds, unitIds },
          });
          await router.invalidate();
          return next;
        }}
        settingsAction={
          <ActionLink
            params={{ courseId: course.id }}
            to="/courses/$courseId/settings"
            variant="quiet"
          >
            Einstellungen
          </ActionLink>
        }
        targetLabel={targetLabel}
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
