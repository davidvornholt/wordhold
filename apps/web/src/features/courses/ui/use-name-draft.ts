import { type SubmitEvent, useState } from 'react';

type NameDraftOptions = {
  // The current name when renaming; absent when naming something new.
  readonly initialName?: string;
  // The message to show instead of saving, or null when the name is free.
  readonly conflict: (name: string) => string | null;
  readonly save: (name: string) => Promise<void>;
  readonly failedMessage: string;
  readonly onSaved: (name: string) => void;
};

// One name being typed and saved: a new subject, book or unit, or a new name
// for one. Saving is offered once the trimmed name is filled in and differs
// from the current one.
export const useNameDraft = ({
  initialName,
  conflict,
  save,
  failedMessage,
  onSaved,
}: NameDraftOptions) => {
  const [name, setName] = useState(initialName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const submittable = !busy && trimmed !== '' && trimmed !== initialName;

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submittable) {
      return;
    }
    const conflictMessage = conflict(trimmed);
    if (conflictMessage !== null) {
      setError(conflictMessage);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await save(trimmed);
      onSaved(trimmed);
    } catch {
      setError(failedMessage);
    } finally {
      setBusy(false);
    }
  };

  // Back to the current name, for the next time a dialog opens.
  const reset = () => {
    setName(initialName ?? '');
    setError(null);
  };

  return { name, setName, busy, error, submittable, submit, reset } as const;
};
