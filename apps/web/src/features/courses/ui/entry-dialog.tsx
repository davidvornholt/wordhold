import { type ReactNode, type RefObject, useRef } from 'react';
import { Dialog } from '../../../shared/ui/dialog';
import { EntryDialogContext } from './entry-dialog-context';

type EntryDialogProps = {
  readonly open: boolean;
  // In the plural, "Vokabeln eintragen", since one entry follows another.
  readonly title: string;
  readonly onClose: () => void;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  readonly children: ReactNode;
};

// The desk new entries are typed on, one card after another. It has no
// button of its own: the card's foot offers both ways on, "Eintragen" to file
// the entry and take the next card and "Fertig" to file it and leave, side by
// side where the typing ends. Escape leaves the same way as "Fertig", so a
// typed entry is never dropped unasked.
export const EntryDialog = ({
  open,
  title,
  onClose,
  returnFocusRef,
  children,
}: EntryDialogProps) => {
  const finishRef = useRef<(() => void) | null>(null);
  return (
    <Dialog
      closable={true}
      onClose={() => (finishRef.current ?? onClose)()}
      open={open}
      returnFocusRef={returnFocusRef}
      surface="desk"
      title={title}
    >
      <EntryDialogContext value={{ close: onClose, finishRef }}>
        {children}
      </EntryDialogContext>
    </Dialog>
  );
};
