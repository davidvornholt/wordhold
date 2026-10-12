import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { VocabularyEntry } from '../schemas/course-units';

// What an entry's dialog hands the form that corrects the entry.
export type EntryEditorControl = {
  // True while a correction is being saved, so the dialog stays open.
  readonly onBusyChange: (busy: boolean) => void;
  // The dialog shows the details again, with the notice.
  readonly onSaved: (notice: string) => void;
  readonly onCancel: () => void;
};

// What can be done with an entry from its dialog, and with a selection of
// entries from the list.
export type CourseEntryActions = {
  // The example sentence of a word, the key points of a term, or nothing
  // for a text.
  readonly renderDetail: (entry: VocabularyEntry) => ReactNode;
  readonly renderEditor: (
    entry: VocabularyEntry,
    control: EntryEditorControl,
  ) => ReactNode;
  // Resolves once the entry is deleted. The list refreshes afterwards, so
  // the dialog closes while the entry's row is still there.
  readonly remove: (entry: VocabularyEntry) => Promise<void>;
  // Moves cards past the learning pass, straight to their first practice, or
  // returns cards not yet practised to it. Each resolves to the cards it
  // changed once the list shows the change.
  readonly skipLearning: (
    cardIds: ReadonlyArray<string>,
  ) => Promise<ReadonlyArray<string>>;
  readonly returnToLearning: (
    cardIds: ReadonlyArray<string>,
  ) => Promise<ReadonlyArray<string>>;
};

// Saving a corrected entry: the form is disabled meanwhile, and the dialog
// cannot be closed. A failure is shown in the form, and focus returns to its
// first field once the form is enabled again.
export const useEntryEdit = (control: EntryEditorControl, fallback: string) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const refocusRef = useRef(false);

  useEffect(() => {
    if (!busy && refocusRef.current) {
      refocusRef.current = false;
      firstFieldRef.current?.focus();
    }
  }, [busy]);

  // The change resolves to the notice the details show afterwards.
  const save = async (change: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    control.onBusyChange(true);
    try {
      control.onSaved(await change());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : fallback);
      refocusRef.current = true;
    } finally {
      setBusy(false);
      control.onBusyChange(false);
    }
  };

  return { busy, error, firstFieldRef, save } as const;
};
