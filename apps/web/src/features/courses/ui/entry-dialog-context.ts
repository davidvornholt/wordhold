import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
} from 'react';

type EntryDialogValue = {
  // The dialog's title, which the card it is typed on carries.
  readonly title: string;
  readonly titleId: string;
  readonly close: () => void;
  // What Escape does instead of closing: the card's own "Schließen".
  readonly requestCloseRef: RefObject<(() => void) | null>;
};

export const EntryDialogContext = createContext<EntryDialogValue | null>(null);

export const useEntryDialog = (): EntryDialogValue => {
  const value = useContext(EntryDialogContext);
  if (value === null) {
    throw new Error('An entry form opens in an EntryDialog.');
  }
  return value;
};

// Where the entries go, as a control on the card under its title, when the
// dialog was opened from no place of its own. It is on the card rather than
// around it, since the dimmed page around the card gives a control no
// contrast.
export const EntryPlaceContext = createContext<ReactNode>(null);
