import {
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { PencilIcon } from 'lucide-react';
import { useState } from 'react';
import type { ExamDetail } from '../../../../../features/exams/schemas/exam-models';
import { startExamRound } from '../../../../../features/exams/services/server-fns';
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
import { ArchiveToggle } from './-archive-toggle';

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
    <div className="flex flex-wrap items-center gap-4">
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
    </div>
  );
};

// An archived test asks nothing until it is brought back.
const ExamActions = ({ exam }: { readonly exam: ExamDetail }) => {
  const router = useRouter();
  if (exam.archivedAt !== null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          Der Test ist archiviert. Er behält seine Runden, startet aber keine
          neue.
        </p>
        <ArchiveToggle afterChange={() => router.invalidate()} exam={exam} />
      </div>
    );
  }
  return exam.cards.learned === 0 ? null : <RoundControls exam={exam} />;
};

const ExamScreen = () => {
  const { course, exam } = Route.useLoaderData();
  const { missed } = exam.readiness;
  const { unlearned, unlearnedEntryIds, switchedOff } = exam.cards;
  return (
    <PageLayout
      backControl={
        exam.archivedAt === null ? (
          <BackLink params={{ courseId: course.id }} to="/courses/$courseId">
            {course.name}
          </BackLink>
        ) : (
          <BackLink
            params={{ courseId: course.id }}
            to="/courses/$courseId/exams/archive"
          >
            Archivierte Tests
          </BackLink>
        )
      }
      title={exam.name}
      titleAction={
        <ActionLink
          aria-label="Test bearbeiten"
          params={{ courseId: course.id, examId: exam.id }}
          title="Test bearbeiten"
          to="/courses/$courseId/exams/$examId/edit"
          variant="icon"
        >
          <PencilIcon aria-hidden={true} className="size-5" />
        </ActionLink>
      }
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
              variant="quiet"
            >
              Jetzt kennenlernen
            </ActionLink>
          )
        }
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
        roundAction={<ExamActions exam={exam} />}
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
