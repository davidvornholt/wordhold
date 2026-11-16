import { Button } from '../../../shared/ui/button';
import { staleEntryEditMessage } from '../errors/courses-errors';

type EditEntryFooterProps = {
  readonly busy: boolean;
  readonly submittable: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
};

// The end of a form that corrects an entry: why saving failed, and the
// buttons to save or to go back to the details unchanged. An entry saved
// meanwhile from another tab can only be corrected after the page is loaded
// again, so that failure also offers to do so.
export const EditEntryFooter = ({
  busy,
  submittable,
  error,
  onCancel,
}: EditEntryFooterProps) => (
  <>
    {error === null ? null : (
      <p className="text-destructive text-sm" role="alert">
        {error}
      </p>
    )}
    <div className="flex flex-wrap items-center gap-4">
      <Button disabled={!submittable} type="submit">
        {busy ? 'Wird gespeichert …' : 'Speichern'}
      </Button>
      <Button disabled={busy} onClick={onCancel} variant="quiet-muted">
        Abbrechen
      </Button>
      {error === staleEntryEditMessage ? (
        <Button
          onClick={() => globalThis.location.reload()}
          type="button"
          variant="quiet-muted"
        >
          Seite neu laden
        </Button>
      ) : null}
    </div>
  </>
);
