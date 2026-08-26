import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { getCourseDirections } from '../../../features/courses/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import { parsePracticeSearch } from '../../../features/practice/schemas/session-request';
import type { PracticeSession } from '../../../features/practice/services/practice-service';
import {
  getPracticeSession,
  submitAnswer,
} from '../../../features/practice/services/server-fns';
import {
  resolveSessionDirection,
  sessionOptions,
} from '../../../features/practice/services/session-options';
import {
  advanceQueue,
  createSessionQueue,
} from '../../../features/practice/services/session-queue';
import { CardPractice } from '../../../features/practice/ui/card-practice';
import {
  PracticeEmpty,
  PracticeLayout,
} from '../../../features/practice/ui/practice-layout';
import { SessionProgress } from '../../../features/practice/ui/session-progress';
import { SessionStart } from '../../../features/practice/ui/session-start';
import { germanLabels } from '../../../shared/languages';

type SessionRunnerProps = {
  readonly session: PracticeSession;
  readonly targetLabel: string;
};

const SessionRunner = ({ session, targetLabel }: SessionRunnerProps) => {
  const [queue, setQueue] = useState(() => createSessionQueue(session.items));
  const card = queue.pending.at(0);

  return (
    <>
      {queue.total === 0 ? null : (
        <SessionProgress settled={queue.settled} total={queue.total} />
      )}
      {card === undefined ? (
        <PracticeEmpty
          backControl={
            <Link className="text-sm underline" to="/">
              Zurück zur Übersicht
            </Link>
          }
          correct={queue.correct}
          total={queue.total}
          ungraded={queue.ungraded}
          wrong={queue.wrong}
        />
      ) : (
        <CardPractice
          item={card}
          key={`${card.cardId}-${card.revision}`}
          onNext={(result) =>
            setQueue((current) => advanceQueue(current, card, result))
          }
          repeated={card.repeated}
          submit={submitAnswer}
          targetLabel={targetLabel}
        />
      )}
    </>
  );
};

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
      courseName={course.name}
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
          key={direction}
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
