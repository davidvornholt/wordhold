import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  getCourseDirections,
  listCourseVocabulary,
} from '../../../../../features/courses/services/server-fns';
import {
  deleteExam,
  updateExam,
} from '../../../../../features/exams/services/server-fns';
import { failureText } from '../../../../../features/exams/ui/exam-figures';
import { ExamForm } from '../../../../../features/exams/ui/exam-form';
import { getCourse } from '../../../../../features/import/server-fns';
import { ActionLink } from '../../../../../shared/ui/action-link';
import { BackLink } from '../../../../../shared/ui/back-link';
import { Button } from '../../../../../shared/ui/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog';
import { PageLayout } from '../../../../../shared/ui/page-layout';
import { getExamOfCourse } from '../-exam-of-course';
import { ArchiveToggle } from './-archive-toggle';

// Deleting a test removes its rounds. The answers stay in the review log as
// ordinary practice.
const DeleteExam = ({
  courseId,
  examId,
  name,
}: {
  readonly courseId: string;
  readonly examId: string;
  readonly name: string;
}) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  return (
    <section className="flex flex-col gap-3">
      <Button
        className="w-fit"
        onClick={() => setOpen(true)}
        variant="destructive"
      >
        Test löschen
      </Button>
      <output aria-live="polite" className="text-destructive text-sm">
        {status}
      </output>
      <ConfirmDialog
        busy={busy}
        cancelLabel="Behalten"
        confirmLabel="Löschen"
        description="Seine Runden und Ergebnisse verschwinden. Deine Antworten zählen weiter für den Lernplan."
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteExam({ data: { examId } });
            await navigate({
              params: { courseId },
              to: '/courses/$courseId',
            });
          } catch (cause) {
            setStatus(
              failureText(cause, 'Der Test konnte nicht gelöscht werden.'),
            );
            setBusy(false);
            setOpen(false);
          }
        }}
        open={open}
        title={`„${name}“ löschen?`}
      />
    </section>
  );
};

const EditExamScreen = () => {
  const { course, directions, entries, exam } = Route.useLoaderData();
  const navigate = useNavigate();
  const examPage = {
    params: { courseId: course.id, examId: exam.id },
    to: '/courses/$courseId/exams/$examId',
  } as const;
  return (
    <PageLayout
      backControl={<BackLink {...examPage}>{exam.name}</BackLink>}
      title={`${exam.name} bearbeiten`}
    >
      <p className="text-muted-foreground text-sm">
        Runden, die du schon gemacht hast, behalten die Karten, die sie
        abgefragt haben. Die nächste Runde fragt den Test so ab, wie du ihn hier
        speicherst.
      </p>
      <ExamForm
        cancelControl={
          <ActionLink {...examPage} variant="quiet-muted">
            Abbrechen
          </ActionLink>
        }
        courseDirections={directions}
        entries={entries}
        initial={{
          name: exam.name,
          directions: exam.directions,
          entryIds: exam.entries.map((entry) => entry.id),
        }}
        save={async (draft) => {
          await updateExam({ data: { examId: exam.id, ...draft } });
          await navigate(examPage);
        }}
        subject={course}
        submitLabel="Speichern"
      />
      <div className="flex flex-col gap-6 border-border border-t pt-6">
        <section className="flex flex-col gap-3">
          <p className="text-sm">
            {exam.archivedAt === null
              ? 'Ist der Test geschrieben, archivierst du ihn. Er behält seine Runden, startet aber keine neue, und steht dann im Archiv des Kurses.'
              : 'Der Test ist archiviert. Holst du ihn zurück, kannst du wieder Runden starten.'}
          </p>
          <ArchiveToggle afterChange={() => navigate(examPage)} exam={exam} />
        </section>
        <DeleteExam courseId={course.id} examId={exam.id} name={exam.name} />
      </div>
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/exams/$examId/edit')({
  loader: async ({ params }) => {
    const [course, directions, entries, exam] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseDirections({ data: params.courseId }),
      listCourseVocabulary({ data: params.courseId }),
      getExamOfCourse(params.courseId, params.examId),
    ]);
    return { course, directions, entries, exam };
  },
  component: EditExamScreen,
});
