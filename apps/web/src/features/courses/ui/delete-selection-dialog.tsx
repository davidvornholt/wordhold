import { type RefObject, useState } from 'react';
import { type CourseSubject, courseNouns } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { Dialog } from '../../../shared/ui/dialog';
import type { VocabularyEntry } from '../schemas/course-units';
import { EntryDeletion } from './entry-deletion';

type SelectionDeletionProps = {
  readonly count: string;
  readonly remove: () => Promise<void>;
  readonly onBusyChange: (busy: boolean) => void;
  readonly onDeleted: (notice: string) => void;
  readonly onKeep: () => void;
};

// Mounted per opening, so a failure from the last one is forgotten.
const SelectionDeletion = ({
  count,
  remove,
  onBusyChange,
  onDeleted,
  onKeep,
}: SelectionDeletionProps) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setDeleting(true);
    setError(null);
    onBusyChange(true);
    try {
      await remove();
      onBusyChange(false);
      onDeleted(`${count} gelöscht.`);
    } catch {
      setError('Das Löschen hat nicht geklappt. Versuche es noch einmal.');
      setDeleting(false);
      onBusyChange(false);
    }
  };
  return (
    <EntryDeletion
      deleting={deleting}
      error={error}
      onConfirm={() => {
        confirm().catch(() => undefined);
      }}
      onKeep={onKeep}
    />
  );
};

type DeleteSelectionDialogProps = {
  readonly open: boolean;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly subject: CourseSubject;
  readonly remove: (entryIds: ReadonlyArray<string>) => Promise<void>;
  readonly returnFocusRef: RefObject<HTMLElement | null> | undefined;
  readonly onDeleted: (notice: string) => void;
  readonly onClose: () => void;
};

// Asks before deleting a selection, naming how many entries go. The count
// includes entries the list's current search or filter hides.
export const DeleteSelectionDialog = ({
  open,
  entries,
  subject,
  remove,
  returnFocusRef,
  onDeleted,
  onClose,
}: DeleteSelectionDialogProps) => {
  const [busy, setBusy] = useState(false);
  const nouns = courseNouns(subject);
  const count = countNoun(entries.length, nouns.singular, nouns.plural);
  return (
    <Dialog
      closable={!busy}
      onClose={onClose}
      open={open}
      returnFocusRef={returnFocusRef}
      // Closed, it names no count, since no selection is being deleted.
      title={open ? `${count} löschen?` : ''}
    >
      <SelectionDeletion
        count={count}
        onBusyChange={setBusy}
        onDeleted={onDeleted}
        onKeep={onClose}
        remove={() => remove(entries.map((entry) => entry.id))}
      />
    </Dialog>
  );
};
