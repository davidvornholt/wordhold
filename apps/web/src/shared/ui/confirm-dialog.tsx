import type { ReactNode, RefObject } from 'react';
import { Button } from './button';
import { Dialog } from './dialog';

type ConfirmDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description: ReactNode;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  // Where focus goes on closing when the control that opened the dialog is
  // gone, such as the button of a row the confirmation removed.
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
};

// A question over the page, answered with one of two buttons. Focus starts
// on the confirmation, which names what it does.
export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
  returnFocusRef,
}: ConfirmDialogProps) => (
  <Dialog
    closable={!busy}
    description={description}
    onClose={onCancel}
    open={open}
    returnFocusRef={returnFocusRef}
    title={title}
  >
    <div className="flex flex-wrap gap-3">
      <Button
        autoFocus={true}
        disabled={busy}
        onClick={onConfirm}
        variant="destructive"
      >
        {confirmLabel}
      </Button>
      <Button disabled={busy} onClick={onCancel} variant="quiet">
        {cancelLabel}
      </Button>
    </div>
  </Dialog>
);
