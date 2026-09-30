import { Button } from '../../../shared/ui/button';

type EditEntryFooterProps = {
  readonly busy: boolean;
  readonly submittable: boolean;
  readonly error: string | null;
  readonly onCancel: () => void;
};

// The end of a form that corrects an entry: why saving failed, and the
// buttons to save or to go back to the details unchanged.
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
    </div>
  </>
);
