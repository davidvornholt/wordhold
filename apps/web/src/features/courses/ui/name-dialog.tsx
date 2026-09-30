import { type ReactNode, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import { fieldOnCardClass } from '../../../shared/ui/field-styles';
import { useNameDraft } from './use-name-draft';

type NameDialogProps = {
  // The button that opens the dialog, such as "Neues Buch".
  readonly openLabel: string;
  readonly title: string;
  readonly description?: ReactNode;
  readonly label: string;
  readonly placeholder: string;
  readonly submitLabel: string;
  // The submit button's text while the name is being saved.
  readonly pendingLabel: string;
  readonly maxLength: number;
  // The current name when renaming; absent when naming something new.
  readonly initialName?: string;
  // The message to show instead of saving, or null when the name is free.
  readonly conflict: (name: string) => string | null;
  // Saves the name. The dialog closes once it has.
  readonly save: (name: string) => Promise<void>;
  readonly failedMessage: string;
};

// Naming something new, or renaming it, in a dialog with one field. A taken
// name or a failed save is explained in the dialog, which stays open to try
// again; a saved name closes it.
export const NameDialog = ({
  openLabel,
  title,
  description,
  label,
  placeholder,
  submitLabel,
  pendingLabel,
  maxLength,
  initialName,
  conflict,
  save,
  failedMessage,
}: NameDialogProps) => {
  const [open, setOpen] = useState(false);
  const { name, setName, busy, error, submittable, submit, reset } =
    useNameDraft({
      initialName,
      conflict,
      save,
      failedMessage,
      onSaved: () => setOpen(false),
    });
  const submitText = busy ? pendingLabel : submitLabel;
  return (
    <>
      <Button
        aria-haspopup="dialog"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        variant="quiet"
      >
        {openLabel}
      </Button>
      <Dialog
        closable={!busy}
        description={description}
        onClose={() => setOpen(false)}
        open={open}
        title={title}
      >
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{label}</span>
            <input
              autoFocus={true}
              className={fieldOnCardClass}
              disabled={busy}
              maxLength={maxLength}
              onChange={(event) => setName(event.target.value)}
              placeholder={placeholder}
              value={name}
            />
          </label>
          {error === null ? null : (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <Button disabled={!submittable} type="submit">
              {submitText}
            </Button>
            <Button
              disabled={busy}
              onClick={() => setOpen(false)}
              variant="quiet"
            >
              Abbrechen
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
};
