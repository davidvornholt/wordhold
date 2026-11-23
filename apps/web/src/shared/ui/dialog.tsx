import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Button } from './button';

type ModalProps = {
  readonly open: boolean;
  // False while a change is being saved, so Escape cannot drop it.
  readonly closable: boolean;
  // What Escape asks for while the dialog is closable.
  readonly onCancel: () => void;
  // Sets `open` to false once the dialog has closed, however it closed.
  readonly onClose: () => void;
  // Where focus goes on closing when the control that opened the dialog may
  // be gone by then. Otherwise focus returns to that control.
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  // The id of the visible title, and of the description if there is one.
  readonly labelledBy: string;
  readonly describedBy?: string;
  // Where the dialog sits, what surface it has and what covers the page.
  readonly className: string;
  readonly children: ReactNode;
};

// A modal over the page instead of a panel inside it, so opening it moves
// nothing underneath. The native dialog traps focus, closes on Escape and
// hands focus back to the control that opened it. Its content mounts only
// once the dialog is shown: a field that takes focus on mount then gets it,
// and every opening starts from a fresh form. Showing and closing happen
// before the browser paints, so the dialog never appears without its
// content. The browser lets a page hold Escape back only once per user
// activation and then closes the dialog itself, which `open` follows once the
// dialog is closable.
export const Modal = ({
  open,
  closable,
  onCancel,
  onClose,
  returnFocusRef,
  labelledBy,
  describedBy,
  className,
  children,
}: ModalProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(false);
  // The browser closed the dialog while a change was being saved. It stays
  // closed, with its content mounted, until the change settles, so its owner
  // learns how the change ended before closing resets it.
  const [closedWhileSaving, setClosedWhileSaving] = useState(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open && !closedWhileSaving) {
      dialog.showModal();
      setShown(true);
    } else if (!open && shown) {
      // The browser may have closed the dialog already.
      if (dialog.open) {
        dialog.close();
      }
      setShown(false);
      setClosedWhileSaving(false);
      returnFocusRef?.current?.focus();
    }
  }, [open, shown, closedWhileSaving, returnFocusRef]);

  useEffect(() => {
    if (open && closedWhileSaving && closable) {
      onClose();
    }
  }, [open, closedWhileSaving, closable, onClose]);

  return (
    <dialog
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
      className={`max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto text-foreground ${className}`}
      onCancel={(event) => {
        // A cancel the page may not hold back closes the dialog, which the
        // close event follows.
        if (!event.cancelable) {
          return;
        }
        event.preventDefault();
        if (closable) {
          onCancel();
        }
      }}
      onClose={() => {
        // The event comes a moment after the close, when the dialog may have
        // been shown again.
        if (!open || dialogRef.current?.open !== false) {
          return;
        }
        if (closable) {
          onClose();
        } else {
          setClosedWhileSaving(true);
        }
      }}
      ref={dialogRef}
    >
      {shown ? children : null}
    </dialog>
  );
};

type DialogProps = Omit<
  ModalProps,
  'labelledBy' | 'describedBy' | 'className' | 'onCancel'
> & {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  // A button beside the title, for a dialog that is left rather than
  // answered, such as a list that is worked through.
  readonly closeLabel?: string;
};

// A modal card with its title at the top, over the dimmed page.
export const Dialog = ({
  title,
  description,
  closeLabel,
  children,
  ...modal
}: DialogProps) => {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Modal
      {...modal}
      className="m-auto max-w-lg border border-border bg-card p-6 backdrop:bg-foreground/40"
      describedBy={description === undefined ? undefined : descriptionId}
      labelledBy={titleId}
      onCancel={modal.onClose}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-display text-xl" id={titleId}>
              {title}
            </h2>
            {closeLabel === undefined ? null : (
              <Button
                className="-my-2.5 shrink-0"
                disabled={!modal.closable}
                onClick={modal.onClose}
                variant="quiet-muted"
              >
                {closeLabel}
              </Button>
            )}
          </div>
          {description === undefined ? null : (
            <div className="text-sm" id={descriptionId}>
              {description}
            </div>
          )}
        </div>
        {children}
      </div>
    </Modal>
  );
};
