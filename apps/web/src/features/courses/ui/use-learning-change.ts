import { useEffect, useRef, useState } from 'react';

export const learningChangeFailure =
  'Das hat nicht geklappt. Versuche es noch einmal.';

// Saving a change to the learning pass from a button that stays in place and
// only changes its label. The button is disabled meanwhile and takes focus
// back afterwards, so the keyboard stays where the change was made.
export const useLearningChange = (onBusyChange: (busy: boolean) => void) => {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const refocusRef = useRef(false);

  useEffect(() => {
    if (!busy && refocusRef.current) {
      refocusRef.current = false;
      buttonRef.current?.focus();
    }
  }, [busy]);

  const run = async (change: () => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    onBusyChange(true);
    try {
      await change();
    } catch {
      setFailed(true);
    } finally {
      refocusRef.current = true;
      setBusy(false);
      onBusyChange(false);
    }
  };

  return { busy, failed, buttonRef, run } as const;
};
