import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { getCourse } from '../../../features/import/server-fns';
import { getPracticeSession } from '../../../features/practice/services/server-fns';
import { CardPractice } from '../../../features/practice/ui/card-practice';
import { germanLabels } from '../../../shared/languages';

const PracticeScreen = () => {
  const { course, session } = Route.useLoaderData();
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });

  const item = session.items.at(index);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <Link className="text-neutral-500 text-sm underline" to="/">
        ← Übersicht
      </Link>
      <h1 className="font-semibold text-2xl">{course.name}: Üben</h1>
      {item === undefined ? (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-6">
          <p className="font-medium">
            {session.items.length === 0
              ? 'Gerade ist nichts fällig.'
              : 'Sitzung abgeschlossen!'}
          </p>
          {session.items.length === 0 ? null : (
            <p className="text-sm">
              {stats.correct} richtig, {stats.wrong} falsch.
            </p>
          )}
          <Link className="text-sm underline" to="/">
            Zurück zur Übersicht
          </Link>
        </div>
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
          targetLabel={germanLabels[course.targetLanguage]}
          total={session.items.length}
        />
      )}
    </main>
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
