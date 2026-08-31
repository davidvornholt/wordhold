import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { getCourseDirections } from '../../../features/courses/services/server-fns';
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
import { countNoun } from '../../../shared/format/count';
import { germanLabels } from '../../../shared/languages';
import { practiceSectionSize } from '../../../shared/practice/session-policy';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';
import { Button } from '../../../shared/ui/button';
import { PageLayout } from '../../../shared/ui/page-layout';

const PracticeScreen = () => {
  const { course, directions, direction, session, stats } =
    Route.useLoaderData();
  const router = useRouter();
  const [sessionGeneration, setSessionGeneration] = useState(0);
  const targetLabel = germanLabels[course.targetLanguage];

  return (
    <PageLayout
      backControl={<BackLink to="/">Übersicht</BackLink>}
      title={`${course.name}: Üben`}
    >
      {session === null ? (
        <SessionStart
          options={sessionOptions(directions, targetLabel, [
            ...(stats?.directions ?? []),
            { direction: 'both', ready: stats?.ready ?? 0 },
          ])}
          preferenceKey={`${course.id}:practice`}
          renderStartAction={(option, rememberDirection) => (
            <ActionLink
              className="w-fit"
              onClick={rememberDirection}
              params={{ courseId: course.id }}
              search={{ direction: option.value }}
              to="/courses/$courseId/practice"
            >
              {countNoun(option.cards, 'Karte', 'Karten')} starten
            </ActionLink>
          )}
        />
      ) : (
        <SessionRunner
          backControl={
            <ActionLink to="/" variant="quiet-muted">
              Zurück zur Übersicht
            </ActionLink>
          }
          continueControl={
            <Button
              onClick={async () => {
                await router.invalidate();
                setSessionGeneration((current) => current + 1);
              }}
            >
              Weitere{' '}
              {Math.min(practiceSectionSize, remainingReadyCount(session))}{' '}
              üben
            </Button>
          }
          emptyMessage="Für jetzt geschafft"
          key={`${direction}-${sessionGeneration}-${session.items
            .map((item) => `${item.cardId}-${item.revision}`)
            .join('|')}`}
          mode="scheduled"
          session={session}
          submit={submitAnswer}
          targetLabel={targetLabel}
        />
      )}
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/practice')({
  validateSearch: parsePracticeSearch,
  loaderDeps: ({ search }) => ({ direction: search.direction }),
  loader: async ({ params, deps }) => {
    const [course, directions, dashboard] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseDirections({ data: params.courseId }),
      getDashboard(),
    ]);
    const direction = resolveSessionDirection(deps.direction, directions);
    const session =
      direction === undefined
        ? null
        : await getPracticeSession({
            data: { courseId: params.courseId, direction },
          });
    return {
      course,
      directions,
      direction,
      session,
      stats: dashboard.perCourse.find(
        (courseStats) => courseStats.courseId === course.id,
      ),
    };
  },
  component: PracticeScreen,
});
