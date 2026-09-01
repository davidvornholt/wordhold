import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import {
  getCourseDirections,
  listCourseUnits,
  prepareVocabularyExamples,
} from '../../../features/courses/services/server-fns';
import { getDashboard } from '../../../features/dashboard/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import { remainingReadyCount } from '../../../features/practice/schemas/practice-models';
import { parsePracticeSearch } from '../../../features/practice/schemas/session-request';
import {
  getPracticeSession,
  submitAnswer,
} from '../../../features/practice/services/server-fns';
import {
  resolveSessionDirection,
  sessionOptions,
} from '../../../features/practice/services/session-options';
import { SessionRunner } from '../../../features/practice/ui/session-runner';
import { SessionStart } from '../../../features/practice/ui/session-start';
import { prepareItemExamples } from '../../../shared/examples/example-model';
import { countNoun } from '../../../shared/format/count';
import { germanLabels } from '../../../shared/languages';
import { readyCardsInNextSection } from '../../../shared/practice/session-policy';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';
import { Button } from '../../../shared/ui/button';
import { PageLayout } from '../../../shared/ui/page-layout';

const PracticeScreen = () => {
  const { availability, course, directions, direction, session, unit } =
    Route.useLoaderData();
  const router = useRouter();
  const [sessionGeneration, setSessionGeneration] = useState(0);
  const targetLabel = germanLabels[course.targetLanguage];
  const pageBackControl =
    unit === undefined ? (
      <BackLink to="/">Übersicht</BackLink>
    ) : (
      <BackLink
        params={{ courseId: course.id, unitId: unit.id }}
        to="/courses/$courseId/units/$unitId"
      >
        {unit.name}
      </BackLink>
    );
  const sessionBackControl =
    unit === undefined ? (
      <ActionLink to="/" variant="quiet-muted">
        Zurück zur Übersicht
      </ActionLink>
    ) : (
      <ActionLink
        params={{ courseId: course.id, unitId: unit.id }}
        to="/courses/$courseId/units/$unitId"
        variant="quiet-muted"
      >
        Zurück zu {unit.name}
      </ActionLink>
    );

  return (
    <PageLayout
      backControl={pageBackControl}
      title={`${unit?.name ?? course.name}: Üben`}
    >
      {session === null ? (
        <SessionStart
          itemNoun={{ singular: 'Karte', plural: 'Karten' }}
          options={sessionOptions(directions, targetLabel, [
            ...availability.directions,
            { direction: 'both', ready: availability.ready },
          ])}
          preferenceKey={`${course.id}:practice`}
          renderStartAction={(option, rememberDirection) => (
            <ActionLink
              className="w-fit"
              onClick={rememberDirection}
              params={{ courseId: course.id }}
              search={{ direction: option.value, unit: unit?.id }}
              to="/courses/$courseId/practice"
            >
              {countNoun(option.cards, 'Karte', 'Karten')} starten
            </ActionLink>
          )}
        />
      ) : (
        <SessionRunner
          backControl={sessionBackControl}
          continueControl={
            <Button
              onClick={async () => {
                await router.invalidate();
                setSessionGeneration((current) => current + 1);
              }}
            >
              {remainingReadyCount(session) > 0
                ? `Weitere ${itemsInNextSection(remainingReadyCount(session))} üben`
                : 'Weiter üben'}
            </Button>
          }
          emptyMessage="Für jetzt geschafft"
          key={`${direction}-${sessionGeneration}-${session.items
            .map((item) => `${item.cardId}-${item.revision}`)
            .join('|')}`}
          mode="scheduled"
          prepareExamples={prepareVocabularyExamples}
          session={session}
          submit={submitAnswer}
          targetLabel={targetLabel}
          targetLanguage={course.targetLanguage}
        />
      )}
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/practice')({
  validateSearch: parsePracticeSearch,
  loaderDeps: ({ search }) => ({
    direction: search.direction,
    unit: search.unit,
  }),
  loader: async ({ params, deps }) => {
    const [course, directions, dashboard, units] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseDirections({ data: params.courseId }),
      getDashboard(),
      listCourseUnits({ data: params.courseId }),
    ]);
    const unit = units.find((candidate) => candidate.id === deps.unit);
    const stats = dashboard.perCourse.find(
      (courseStats) => courseStats.courseId === course.id,
    );
    const directionAvailability =
      unit?.directions.map((progress) => ({
        direction: progress.direction,
        ready: readyCardsInNextSection(progress.due, progress.firstReviews),
      })) ??
      stats?.directions ??
      [];
    const unitDue =
      unit?.directions.reduce((total, progress) => total + progress.due, 0) ??
      0;
    const unitFirstReviews =
      unit?.directions.reduce(
        (total, progress) => total + progress.firstReviews,
        0,
      ) ?? 0;
    const ready =
      unit === undefined
        ? (stats?.ready ?? 0)
        : readyCardsInNextSection(unitDue, unitFirstReviews);
    const readyDirections = directionAvailability
      .filter((candidate) => candidate.ready > 0)
      .map((candidate) => candidate.direction);
    const direction = resolveSessionDirection(
      deps.direction,
      directions,
      readyDirections,
    );
    const loadedSession =
      direction === undefined
        ? null
        : await getPracticeSession({
            data: {
              courseId: params.courseId,
              direction,
              unitId: unit?.id,
            },
          });
    const session =
      loadedSession === null
        ? null
        : {
            ...loadedSession,
            items: await prepareItemExamples(
              loadedSession.items,
              prepareVocabularyExamples,
            ),
          };
    return {
      availability: { directions: directionAvailability, ready },
      course,
      directions,
      direction,
      session,
      unit,
    };
  },
  component: PracticeScreen,
});
