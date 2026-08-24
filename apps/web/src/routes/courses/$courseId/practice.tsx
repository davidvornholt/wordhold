import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { getCourse } from '../../../features/import/server-fns';
import {
  getPracticeSession,
  submitAnswer,
} from '../../../features/practice/services/server-fns';
import { CardPractice } from '../../../features/practice/ui/card-practice';
import {
  PracticeEmpty,
  PracticeLayout,
} from '../../../features/practice/ui/practice-layout';
import { germanLabels } from '../../../shared/languages';

const PracticeScreen = () => {
  const { course, session } = Route.useLoaderData();
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });

  const item = session.items.at(index);

  return (
    <PracticeLayout
      backControl={
        <Link className="text-muted-foreground text-sm underline" to="/">
          ← Übersicht
        </Link>
      }
      courseName={course.name}
    >
      {item === undefined ? (
        <PracticeEmpty
          backControl={
            <Link className="text-sm underline" to="/">
              Zurück zur Übersicht
            </Link>
          }
          correct={stats.correct}
          initialSession={session.items.length === 0}
          wrong={stats.wrong}
        />
      ) : (
        <CardPractice
          item={item}
          key={item.cardId}
          onNext={(correct) => {
            if (correct !== null) {
              setStats((current) =>
                correct
                  ? { ...current, correct: current.correct + 1 }
                  : { ...current, wrong: current.wrong + 1 },
              );
            }
            setIndex(index + 1);
          }}
          position={index + 1}
          submit={submitAnswer}
          targetLabel={germanLabels[course.targetLanguage]}
          total={session.items.length}
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
