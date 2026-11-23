import { type ReactNode, type RefObject, useId, useRef } from 'react';
import { Modal } from '../../../shared/ui/dialog';
import { EntryDialogContext } from './entry-dialog-context';

type EntryDialogProps = {
  readonly open: boolean;
  // In the plural, "Vokabeln eintragen", since one entry follows another.
  readonly title: string;
  readonly onClose: () => void;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  readonly children: ReactNode;
};

// A stack of blank index cards over the dimmed page, with no frame of its
// own: the top card carries the title, and the entries filed from it lie
// below. It is held near the top, so the growing list never moves the card.
// Escape asks the card to close, the same as its "Schließen", so a typed
// entry is never dropped unasked.
export const EntryDialog = ({
  open,
  title,
  onClose,
  returnFocusRef,
  children,
}: EntryDialogProps) => {
  const titleId = useId();
  const requestCloseRef = useRef<(() => void) | null>(null);
  return (
    <Modal
      className="mx-auto mt-4 mb-auto max-w-2xl bg-transparent pb-4 backdrop:backdrop-blur-sm sm:mt-[8dvh] sm:max-h-[calc(92dvh-1rem)]"
      closable={true}
      labelledBy={titleId}
      onClose={() => (requestCloseRef.current ?? onClose)()}
      open={open}
      returnFocusRef={returnFocusRef}
    >
      <EntryDialogContext
        value={{ title, titleId, close: onClose, requestCloseRef }}
      >
        {children}
      </EntryDialogContext>
    </Modal>
  );
};
