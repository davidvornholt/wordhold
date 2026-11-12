import { useState } from 'react';
import type { ExamDetail } from '../../../../../features/exams/schemas/exam-models';
import { setExamArchived } from '../../../../../features/exams/services/server-fns';
import { failureText } from '../../../../../features/exams/ui/exam-figures';
import { Button } from '../../../../../shared/ui/button';

type ArchiveToggleProps = {
  readonly exam: ExamDetail;
  // Shows the test as it now stands.
  readonly afterChange: () => Promise<void>;
};

// Archives an active test or brings an archived one back.
export const ArchiveToggle = ({ exam, afterChange }: ArchiveToggleProps) => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const archived = exam.archivedAt !== null;
  return (
    <>
      <Button
        className="w-fit"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setStatus(null);
          try {
            await setExamArchived({
              data: { examId: exam.id, archived: !archived },
            });
            await afterChange();
          } catch (cause) {
            setStatus(
              failureText(cause, 'Der Test konnte nicht gespeichert werden.'),
            );
          } finally {
            setBusy(false);
          }
        }}
        variant="outline"
      >
        {archived ? 'Zurückholen' : 'Test archivieren'}
      </Button>
      {status === null ? null : (
        <p className="w-full text-destructive text-sm" role="alert">
          {status}
        </p>
      )}
    </>
  );
};
