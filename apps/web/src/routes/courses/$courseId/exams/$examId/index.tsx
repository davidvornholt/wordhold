import {
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { useState } from 'react';
import type { ExamDetail } from '../../../../../features/exams/schemas/exam-models';
import {
  setExamArchived,
  startExamRound,
} from '../../../../../features/exams/services/server-fns';
import {
  failureText,
  missedPracticeSearch,
} from '../../../../../features/exams/ui/exam-figures';
import { ExamOverview } from '../../../../../features/exams/ui/exam-overview';
import { getCourse } from '../../../../../features/import/server-fns';
import { ActionLink } from '../../../../../shared/ui/action-link';
import { BackLink } from '../../../../../shared/ui/back-link';
import { Button } from '../../../../../shared/ui/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog';
import { PageLayout } from '../../../../../shared/ui/page-layout';
import { getExamOfCourse } from '../-exam-of-course';

const roundPage = (exam: ExamDetail, roundId: string) =>
  ({
    params: { courseId: exam.courseId, examId: exam.id, roundId },
    to: '/courses/$courseId/exams/$examId/rounds/$roundId',
  }) as const;

// An open round is continued. Starting over gives it up, which the round
// history then shows as given up.
const RoundControls = ({ exam }: { readonly exam: ExamDetail }) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  if (exam.archivedAt !== null || exam.cards.learned === 0) {
    return null;
  }
  const start = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const { roundId } = await startExamRound({ data: { examId: exam.id } });
      await navigate(roundPage(exam, roundId));
    } catch (cause) {
      setStatus(
        failureText(cause, 'Die Testrunde konnte nicht gestartet werden.'),
      );
      setBusy(false);
      setConfirming(false);
    }
  };
  const { openRound } = exam;
  return (
    <>
      {openRound === null ? (
        <Button disabled={busy} onClick={start}>
          {busy ? 'Wird vorbereitet …' : 'Runde starten'}
        </Button>
      ) : (
        <>
          <ActionLink {...roundPage(exam, openRound.id)}>
            Runde fortsetzen ({openRound.answered} von {openRound.total})
          </ActionLink>
          <Button onClick={() => setConfirming(true)} variant="quiet">
            Neu beginnen
          </Button>
        </>
      )}
      {status === null ? null : (
        <p className="w-full text-destructive text-sm" role="alert">
          {status}
        </p>
      )}
      <ConfirmDialog
        busy={busy}
        cancelLabel="Weitermachen"
        confirmLabel="Neue Runde starten"
        description="Die angefangene Runde zählt dann als abgebrochen und nicht für deinen Stand."
        onCancel={() => setConfirming(false)}
        onConfirm={start}
        open={confirming}
        title="Neue Runde starten?"
      />
    </>
  );
};

const ManageActions = ({ exam }: { readonly exam: ExamDetail }) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const archived = exam.archivedAt !== null;
  return (
    <>
      <ActionLink
        params={{ courseId: exam.courseId, examId: exam.id }}
        to="/courses/$courseId/exams/$examId/edit"
        variant="quiet"
      >
        Bearbeiten
      </ActionLink>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setStatus(null);
          try {
            await setExamArchived({
              data: { examId: exam.id, archived: !archived },
            });
            await router.invalidate();
          } catch (cause) {
            setStatus(
              failureText(cause, 'Der Test konnte nicht gespeichert werden.'),
            );
          } finally {
            setBusy(false);
          }
        }}
        variant="quiet"
      >
        {archived ? 'Zurückholen' : 'Archivieren'}
      </Button>
      {status === null ? null : (
        <p className="w-full text-destructive text-sm" role="alert">
          {status}
        </p>
      )}
    </>
  );
};

const ExamScreen = () => {
  const { course, exam } = Route.useLoaderData();
  const { missed } = exam.readiness;
  const { unlearned, unlearnedEntryIds, switchedOff } = exam.cards;
  return (
    <PageLayout
      backControl={
        <BackLink
          params={{ courseId: course.id }}
          to="/courses/$courseId/exams"
        >
          Tests
        </BackLink>
      }
      title={exam.name}
    >
      <ExamOverview
        exam={exam}
        learnAction={
          unlearned <= switchedOff ? null : (
            <ActionLink
              className="w-fit"
              params={{ courseId: course.id }}
              search={{
                mode: 'learn',
                entries: unlearnedEntryIds.join(','),
                exam: exam.id,
              }}
              to="/courses/$courseId/study"
              variant="outline"
            >
              Jetzt kennenlernen
            </ActionLink>
          )
        }
        manageActions={<ManageActions exam={exam} />}
        practiceMissedAction={
          missed.length === 0 ? null : (
            <ActionLink
              className="w-fit"
              params={{ courseId: course.id }}
              search={{
                mode: 'practice',
                ...missedPracticeSearch(missed),
                exam: exam.id,
              }}
              to="/courses/$courseId/study"
              variant="outline"
            >
              Diese Fehler üben
            </ActionLink>
          )
        }
        roundAction={<RoundControls exam={exam} />}
        subject={course}
      />
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/exams/$examId/')({
  loader: async ({ params }) => {
    const [course, exam] = await Promise.all([
      getCourse({ data: params.courseId }),
      getExamOfCourse(params.courseId, params.examId),
    ]);
    return { course, exam };
  },
  component: ExamScreen,
});
