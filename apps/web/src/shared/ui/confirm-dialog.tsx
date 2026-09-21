import { type ReactNode, useEffect, useId, useRef } from 'react';
import { Button } from './button';

type ConfirmDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description: ReactNode;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

// A modal question over the page instead of a panel inside it, so asking
// moves nothing underneath. The native dialog traps focus, closes on Escape
// and hands focus back to the control that opened it.
export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      confirmRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-md border border-border bg-card p-6 text-foreground backdrop:bg-foreground/40"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onCancel();
        }
      }}
      ref={dialogRef}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-xl" id={titleId}>
            {title}
          </h2>
          <p className="text-sm" id={descriptionId}>
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy}
            onClick={onConfirm}
            ref={confirmRef}
            variant="destructive"
          >
            {confirmLabel}
          </Button>
          <Button disabled={busy} onClick={onCancel} variant="quiet">
            {cancelLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
};
