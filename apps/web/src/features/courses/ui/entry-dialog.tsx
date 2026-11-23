import { type ReactNode, type RefObject, useId, useRef } from 'react';
import { Modal } from '../../../shared/ui/dialog';
import { EntryDialogContext, EntryPlaceContext } from './entry-dialog-context';

type EntryDialogProps = {
  readonly open: boolean;
  // In the plural, "Vokabeln eintragen", since one entry follows another.
  readonly title: string;
  // The book, unit or subject the entries go to, named under the title
  // because the dialog covers the page that names it. Left out where the
  // card lets the learner choose the place.
  readonly place?: string | undefined;
  readonly onClose: () => void;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  readonly children: ReactNode;
};

// A stack of blank index cards on a table of the page's own color, like the
// practice screen, so nothing of the page behind competes with the typing.
// The top card carries the title and the place, and the entries filed from
// it lie below. It is held near the top, so the growing list never moves the
// card. Escape asks the card to close, the same as its "Schließen", so a
// typed entry is never dropped unasked.
export const EntryDialog = ({
  open,
  title,
  place,
  onClose,
  returnFocusRef,
  children,
}: EntryDialogProps) => {
  const titleId = useId();
  const placeId = useId();
  const requestCloseRef = useRef<(() => void) | null>(null);
  return (
    <Modal
      className="mx-auto mt-4 mb-auto max-w-2xl bg-transparent pb-4 backdrop:bg-background sm:mt-[8dvh] sm:max-h-[calc(92dvh-1rem)]"
      closable={true}
      describedBy={place === undefined ? undefined : placeId}
      labelledBy={titleId}
      onCancel={() => (requestCloseRef.current ?? onClose)()}
      onClose={onClose}
      open={open}
      returnFocusRef={returnFocusRef}
    >
      <EntryDialogContext
        value={{ title, titleId, close: onClose, requestCloseRef }}
      >
        <EntryPlaceContext
          value={
            place === undefined ? null : (
              <p className="flex flex-wrap items-baseline gap-x-3" id={placeId}>
                <span className="eyebrow">Eintragen in</span>{' '}
                <span>{place}</span>
              </p>
            )
          }
        >
          {children}
        </EntryPlaceContext>
      </EntryDialogContext>
    </Modal>
  );
};
