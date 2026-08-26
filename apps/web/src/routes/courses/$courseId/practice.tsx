import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { getCourse } from '../../../features/import/server-fns';
import {
  getPracticeSession,
  submitAnswer,
} from '../../../features/practice/services/server-fns';
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
import { germanLabels } from '../../../shared/languages';

const PracticeScreen = () => {
  const { course, session } = Route.useLoaderData();
  const [queue, setQueue] = useState(() => createSessionQueue(session.items));

  const card = queue.pending.at(0);

  return (
    <PracticeLayout
      backControl={
        <Link className="text-muted-foreground text-sm underline" to="/">
          ← Übersicht
        </Link>
      }
      courseName={course.name}
    >
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
          wrong={queue.wrong}
        />
      ) : (
        <CardPractice
          item={card}
          key={`${card.cardId}-${card.revision}`}
          onNext={(result) =>
            setQueue((current) => advanceQueue(current, result))
          }
          repeated={card.repeated}
          submit={submitAnswer}
          targetLabel={germanLabels[course.targetLanguage]}
        />
      )}
    </PracticeLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/practice')({
  loader: async ({ params }) => {
    const [course, session] = await Promise.all([
      getCourse({ data: params.courseId }),
      getPracticeSession({ data: params.courseId }),
    ]);
    return { course, session };
  },
  component: PracticeScreen,
});
