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

// Where the entries go, on the card under its title: the dialog names a
// fixed place, and a form opened from no place of its own puts its choice of
// place here instead.
export const EntryPlaceContext = createContext<ReactNode>(null);
