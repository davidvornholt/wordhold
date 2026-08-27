import { createFileRoute, Link } from '@tanstack/react-router';
import { getCourseDirections } from '../../../features/courses/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import { parsePracticeSearch } from '../../../features/practice/schemas/session-request';
import { getPracticeSession } from '../../../features/practice/services/server-fns';
import {
  resolveSessionDirection,
  sessionOptions,
} from '../../../features/practice/services/session-options';
import { PracticeLayout } from '../../../features/practice/ui/practice-layout';
import { SessionRunner } from '../../../features/practice/ui/session-runner';
import { SessionStart } from '../../../features/practice/ui/session-start';
import { germanLabels } from '../../../shared/languages';

const PracticeScreen = () => {
  const { course, directions, direction, session } = Route.useLoaderData();
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
          options={sessionOptions(directions, targetLabel)}
          renderStartAction={(option) => (
            <Link
              className="w-fit font-medium underline"
              params={{ courseId: course.id }}
              search={{ direction: option.value }}
              to="/courses/$courseId/practice"
            >
              {option.label}
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
          emptyMessage="Gerade ist nichts fällig."
          key={direction}
          mode="scheduled"
          session={session}
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
    const [course, directions] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseDirections({ data: params.courseId }),
    ]);
    const direction = resolveSessionDirection(deps.direction, directions);
    const session =
      direction === undefined
        ? null
        : await getPracticeSession({
            data: { courseId: params.courseId, direction },
          });
    return { course, directions, direction, session };
  },
  component: PracticeScreen,
});
