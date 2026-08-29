import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { getCourseDirections } from '../../../features/courses/services/server-fns';
import { getDashboard } from '../../../features/dashboard/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import { parsePracticeSearch } from '../../../features/practice/schemas/session-request';
import {
  getPracticeSession,
  submitAnswer,
} from '../../../features/practice/services/server-fns';
import {
  resolveSessionDirection,
  sessionOptions,
} from '../../../features/practice/services/session-options';
import { PracticeLayout } from '../../../features/practice/ui/practice-layout';
import { SessionRunner } from '../../../features/practice/ui/session-runner';
import { SessionStart } from '../../../features/practice/ui/session-start';
import { germanLabels } from '../../../shared/languages';

const PracticeScreen = () => {
  const { course, directions, direction, session, stats } =
    Route.useLoaderData();
  const router = useRouter();
  const targetLabel = germanLabels[course.targetLanguage];

  return (
    <PracticeLayout
      backControl={
        <Link className="text-muted-foreground text-sm underline" to="/">
          ← Übersicht
        </Link>
      }
      title={`${course.name}: Üben`}
    >
      {session === null ? (
        <SessionStart
          options={sessionOptions(directions, targetLabel, [
            ...(stats?.directions ?? []),
            { direction: 'both', ready: stats?.ready ?? 0 },
          ])}
          preferenceKey={course.id}
          renderStartAction={(option, rememberDirection) => (
            <Link
              className="inline-flex min-h-11 w-fit items-center bg-primary px-4 py-2 font-medium text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
              onClick={rememberDirection}
              params={{ courseId: course.id }}
              search={{ direction: option.value }}
              to="/courses/$courseId/practice"
            >
              {option.cards} {option.cards === 1 ? 'Karte' : 'Karten'} starten
            </Link>
          )}
        />
      ) : (
        <SessionRunner
          backControl={
            <Link className="text-sm underline" to="/">
              Zurück zur Übersicht
            </Link>
          }
          continueControl={
            <button
              className="min-h-11 bg-primary px-4 py-2 font-medium text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
              onClick={() => router.invalidate()}
              type="button"
            >
              Weitere 20 üben
            </button>
          }
          emptyMessage="Für jetzt geschafft"
          key={`${direction}-${session.items.at(0)?.cardId ?? 'empty'}`}
          mode="scheduled"
          session={session}
          submit={submitAnswer}
          targetLabel={targetLabel}
        />
      )}
    </PracticeLayout>
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
