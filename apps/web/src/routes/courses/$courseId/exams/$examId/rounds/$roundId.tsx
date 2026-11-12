import { createFileRoute } from '@tanstack/react-router';
import { prepareVocabularyExamples } from '../../../../../../features/courses/services/server-fns';
import { prepareSpellingPitfalls } from '../../../../../../features/courses/services/spelling-pitfall-server-fns';
import { getCourse } from '../../../../../../features/import/server-fns';
import {
  getExamRoundSession,
  submitAnswer,
} from '../../../../../../features/practice/services/server-fns';
import { SessionRunner } from '../../../../../../features/practice/ui/session-runner';
import { focusShell } from '../../../../../../shared/routing/shell';
import { ActionLink } from '../../../../../../shared/ui/action-link';
import { BackLink } from '../../../../../../shared/ui/back-link';
import { FocusLayout } from '../../../../../../shared/ui/focus-layout';
import { cardClass } from '../../../../../../shared/ui/surface-styles';
import { getExamOfCourse } from '../../-exam-of-course';

// A round is asked like a free practice sitting: answers count for the
// schedule only where free practice would let them. Each answer is linked to
// the round, which scores the first one per card.
const RoundScreen = () => {
  const { course, exam, roundId, session } = Route.useLoaderData();
  const examPage = {
    params: { courseId: course.id, examId: exam.id },
    to: '/courses/$courseId/exams/$examId',
  } as const;
  return (
    <FocusLayout
      exit={<BackLink {...examPage}>{exam.name}</BackLink>}
      title={`${exam.name} · Runde`}
    >
      {session === null ? (
        <div className={`flex flex-col items-start gap-4 ${cardClass}`}>
          <p className="text-sm">
            Diese Runde ist vorbei: Sie ist abgeschlossen, oder eine neuere
            Runde hat sie abgelöst.
          </p>
          <ActionLink {...examPage}>Zum Test</ActionLink>
        </div>
      ) : (
        <SessionRunner
          backControl={<ActionLink {...examPage}>Ergebnis ansehen</ActionLink>}
          emptyMessage="Die übrigen Karten dieser Runde sind wieder zum Kennenlernen offen. Sobald du sie kennengelernt hast, kommen sie zurück in die Runde. Du kannst beim Test auch eine neue Runde beginnen."
          key={roundId}
          mode="drill"
          prepareExamples={prepareVocabularyExamples}
          preparePitfalls={prepareSpellingPitfalls}
          session={session}
          subject={course}
          submit={({ data }) =>
            submitAnswer({ data: { ...data, examRoundId: roundId } })
          }
        />
      )}
    </FocusLayout>
  );
};

export const Route = createFileRoute(
  '/courses/$courseId/exams/$examId/rounds/$roundId',
)({
  staticData: focusShell,
  loader: async ({ params }) => {
    const [course, exam] = await Promise.all([
      getCourse({ data: params.courseId }),
      getExamOfCourse(params.courseId, params.examId),
    ]);
    // Only the open round still asks; a finished or given-up one is shown
    // as over instead of starting again.
    const session =
      exam.openRound?.id === params.roundId
        ? await getExamRoundSession({ data: { roundId: params.roundId } })
        : null;
    return { course, exam, roundId: params.roundId, session };
  },
  component: RoundScreen,
});
