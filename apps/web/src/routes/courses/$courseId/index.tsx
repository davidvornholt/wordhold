import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import {
  type CourseUnit,
  courseTotals,
  recommendedUnitAction,
} from '../../../features/courses/schemas/course-units';
import {
  createCourseBook,
  createCourseUnit,
  getCourseOutline,
  renameCourseBook,
  reorderCourseUnits,
} from '../../../features/courses/services/server-fns';
import { CourseOverview } from '../../../features/courses/ui/course-overview';
import { getDashboard } from '../../../features/dashboard/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import { directionLabel } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { germanLabels, languageSubtitle } from '../../../shared/languages';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';
import { PageLayout } from '../../../shared/ui/page-layout';

// Practice comes first while cards are ready, then the next unit to learn,
// and a course without vocabulary starts with a photographed page.
const coursePrimaryAction = ({
  courseId,
  isEmpty,
  ready,
  targetLabel,
  units,
}: {
  readonly courseId: string;
  readonly isEmpty: boolean;
  readonly ready: number;
  readonly targetLabel: string;
  readonly units: ReadonlyArray<CourseUnit>;
}): ReactNode => {
  const nextUnit = units.find((unit) => unit.unintroduced > 0);
  if (ready > 0) {
    return (
      <ActionLink params={{ courseId }} to="/courses/$courseId/practice">
        {countNoun(ready, 'Karte', 'Karten')} üben
      </ActionLink>
    );
  }
  if (nextUnit !== undefined) {
    const recommendation = recommendedUnitAction(nextUnit);
    const recommendedDirection =
      recommendation?.kind === 'learn'
        ? nextUnit.directions.find(
            (progress) => progress.direction === recommendation.direction,
          )
        : undefined;
    return (
      <ActionLink
        params={{ courseId, unitId: nextUnit.id }}
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
  }
  if (isEmpty) {
    return (
      <ActionLink params={{ courseId }} to="/courses/$courseId/import">
        Seite fotografieren
      </ActionLink>
    );
  }
  return null;
};

const CourseScreen = () => {
  const { course, outline, stats } = Route.useLoaderData();
  const { units } = outline;
  const router = useRouter();
  // Every edit returns the updated outline for the editor and refreshes the
  // loader so the page behind the editor matches.
  const refreshed = async <A,>(update: Promise<A>): Promise<A> => {
    const next = await update;
    await router.invalidate();
    return next;
  };
  const isEmpty = courseTotals(units).entries === 0;
  const targetLabel = germanLabels[course.targetLanguage];

  return (
    <PageLayout
      backControl={<BackLink to="/">Übersicht</BackLink>}
      title={course.name}
    >
      <CourseOverview
        createBook={(name) =>
          refreshed(createCourseBook({ data: { courseId: course.id, name } }))
        }
        createUnit={(bookId, name) =>
          refreshed(
            createCourseUnit({ data: { courseId: course.id, bookId, name } }),
          )
        }
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
        outline={outline}
        primaryAction={coursePrimaryAction({
          courseId: course.id,
          isEmpty,
          ready: stats?.ready ?? 0,
          targetLabel,
          units,
        })}
        renderUnitLink={(unit) => (
          <Link
            className="w-fit font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            params={{ courseId: course.id, unitId: unit.id }}
            to="/courses/$courseId/units/$unitId"
          >
            {unit.name}
          </Link>
        )}
        renameBook={(bookId, name) =>
          refreshed(
            renameCourseBook({ data: { courseId: course.id, bookId, name } }),
          )
        }
        reorderUnits={(bookId, expectedUnitIds, unitIds) =>
          refreshed(
            reorderCourseUnits({
              data: { courseId: course.id, bookId, expectedUnitIds, unitIds },
            }),
          )
        }
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
      />
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/')({
  loader: async ({ params }) => {
    const [course, outline, dashboard] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseOutline({ data: params.courseId }),
      getDashboard(),
    ]);
    return {
      course,
      outline,
      stats: dashboard.perCourse.find((stats) => stats.courseId === course.id),
    };
  },
  component: CourseScreen,
});
