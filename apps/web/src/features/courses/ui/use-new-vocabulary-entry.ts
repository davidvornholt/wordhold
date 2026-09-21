import { useEffect, useRef, useState } from 'react';
import type { ExampleDraft } from '../../../shared/examples/example-draft';
import type { NewExampleData } from '../../../shared/vocabulary/entry-fields';
import type { CreatedVocabularyEntry } from '../services/vocabulary-entry-service';

export type NewVocabularyEntryDraft = {
  readonly targetText: string;
  readonly nativeText: string;
  readonly example: NewExampleData | undefined;
};

export const emptyDraft: ExampleDraft = {
  targetText: '',
  nativeText: '',
  example: '',
  exampleNativeText: '',
};

const exampleOf = (draft: ExampleDraft): NewExampleData | undefined => {
  const sentence = draft.example.trim();
  if (sentence === '') {
    return undefined;
  }
  const translation = draft.exampleNativeText.trim();
  return {
    targetText: sentence,
    nativeText: translation === '' ? undefined : translation,
    source: draft.exampleGenerated === true ? 'generated' : 'textbook',
  };
};

export const quoted = (word: string): string => `„${word}“`;

// Saving one typed word: the fields are disabled meanwhile, cleared on
// success, and focus returns to the first one once the form is enabled
// again, so the next word can be typed right away.
export const useNewVocabularyEntry = (
  createEntry: (
    draft: NewVocabularyEntryDraft,
  ) => Promise<CreatedVocabularyEntry>,
) => {
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('');
  const targetRef = useRef<HTMLInputElement>(null);
  const refocusRef = useRef(false);

  useEffect(() => {
    if (!busy && refocusRef.current) {
      refocusRef.current = false;
      targetRef.current?.focus();
    }
  }, [busy]);

  const save = async () => {
    const targetText = draft.targetText.trim();
    setBusy(true);
    setFailed(false);
    setStatus(`${quoted(targetText)} wird eingetragen …`);
    try {
      const created = await createEntry({
        targetText,
        nativeText: draft.nativeText.trim(),
        example: exampleOf(draft),
      });
      setDraft(emptyDraft);
      setStatus(
        created.audio === 'generated'
          ? `${quoted(targetText)} eingetragen.`
          : `${quoted(targetText)} eingetragen. Die Aussprache konnte nicht erzeugt werden.`,
      );
      refocusRef.current = true;
    } catch (cause) {
      setFailed(true);
      setStatus(
        cause instanceof Error
          ? cause.message
          : 'Die Vokabel wurde nicht eingetragen. Versuche es noch einmal.',
      );
    } finally {
      setBusy(false);
    }
  };

  return { draft, setDraft, busy, failed, status, targetRef, save } as const;
};
