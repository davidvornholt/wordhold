import { createContext, type RefObject, useContext } from 'react';

type EntryDialogValue = {
  readonly close: () => void;
  // What Escape does instead of closing: the open form's own "Fertig".
  readonly finishRef: RefObject<(() => void) | null>;
};

export const EntryDialogContext = createContext<EntryDialogValue | null>(null);

export const useEntryDialog = (): EntryDialogValue => {
  const value = useContext(EntryDialogContext);
  if (value === null) {
    throw new Error('An entry form opens in an EntryDialog.');
  }
  return value;
};
