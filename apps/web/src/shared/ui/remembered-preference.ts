import { useSyncExternalStore } from 'react';

// A choice this browser remembers, such as a practice direction. Remembering
// is optional: without storage the choice simply has to be made again.
const subscribeToNothing = () => () => undefined;

const readPreference = (storageKey: string): string | null => {
  try {
    return globalThis.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
};

export const rememberPreference = (storageKey: string, value: string): void => {
  try {
    globalThis.localStorage.setItem(storageKey, value);
  } catch {
    // The choice still applies now; it is only not remembered.
  }
};

// Null while rendering on the server and when nothing is remembered.
export const useRememberedPreference = (storageKey: string): string | null =>
  useSyncExternalStore(
    subscribeToNothing,
    () => readPreference(storageKey),
    () => null,
  );
