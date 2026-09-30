import { useEffect, useRef } from 'react';
import { Button } from '../../../shared/ui/button';

type EntryDeletionProps = {
  readonly deleting: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onKeep: () => void;
};

// The question whether to delete the entry, asked in place of its details.
// Focus starts on the confirmation, which names what it does, and returns
// there when deleting failed.
export const EntryDeletion = ({
  deleting,
  error,
  onConfirm,
  onKeep,
}: EntryDeletionProps) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (error !== null) {
      confirmRef.current?.focus();
    }
  }, [error]);

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>
        Löschen entfernt auch den Lernstand und alle bisherigen Antworten. Das
        lässt sich nicht rückgängig machen.
      </p>
      {error === null ? null : (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          autoFocus={true}
          disabled={deleting}
          onClick={onConfirm}
          ref={confirmRef}
          variant="destructive"
        >
          {deleting ? 'Wird gelöscht …' : 'Endgültig löschen'}
        </Button>
        <Button disabled={deleting} onClick={onKeep} variant="quiet">
          Behalten
        </Button>
      </div>
    </div>
  );
};
