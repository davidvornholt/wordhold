import { type SubmitEvent, useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { cardCompactClass } from '../../../shared/ui/surface-styles';
import { findDuplicate } from '../../../shared/vocabulary/entry-identity';
import type { VocabularyEntry } from '../schemas/course-units';
import {
  type SuggestDefinition,
  TermDefinitionFields,
  type TermDraft,
} from './term-definition-fields';
import { quoted } from './use-new-vocabulary-entry';

export type CreateTerm = (draft: TermDraft) => Promise<void>;

type NewTermFormProps = {
  // Every stored term of the subject, so a repeat is pointed out while
  // typing.
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly createEntry: CreateTerm;
  readonly suggestDefinition: SuggestDefinition;
};

const emptyTerm: TermDraft = { term: '', definition: '' };

// Saving one typed term: the fields are disabled meanwhile, cleared on
// success, and focus returns to the term once the form is enabled again, so
// the next term can be typed right away.
const useNewTermEntry = (createEntry: CreateTerm) => {
  const [draft, setDraft] = useState(emptyTerm);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('');
  const termRef = useRef<HTMLInputElement>(null);
  const refocusRef = useRef(false);

  useEffect(() => {
    if (!busy && refocusRef.current) {
      refocusRef.current = false;
      termRef.current?.focus();
    }
  }, [busy]);

  const save = async () => {
    const term = draft.term.trim();
    setBusy(true);
    setFailed(false);
    setStatus(`${quoted(term)} wird eingetragen …`);
    try {
      await createEntry({ term, definition: draft.definition.trim() });
      setDraft(emptyTerm);
      setStatus(`${quoted(term)} eingetragen.`);
      refocusRef.current = true;
    } catch (cause) {
      setFailed(true);
      setStatus(
        cause instanceof Error
          ? cause.message
          : 'Der Begriff wurde nicht eingetragen. Versuche es noch einmal.',
      );
    } finally {
      setBusy(false);
    }
  };

  return { draft, setDraft, busy, failed, status, termRef, save } as const;
};

// One term at a time, for as long as the form stays open. An exact repeat of
// a stored term is stopped here; the same term in another casing is pointed
// out and left to the learner.
export const NewTermForm = ({
  entries,
  createEntry,
  suggestDefinition,
}: NewTermFormProps) => {
  const { draft, setDraft, busy, failed, status, termRef, save } =
    useNewTermEntry(createEntry);
  const term = draft.term.trim();
  const duplicate = findDuplicate(
    { targetText: term, example: '' },
    entries.map((entry) => ({ targetText: entry.targetText, examples: [] })),
  );
  const submittable =
    !busy &&
    term !== '' &&
    draft.definition.trim() !== '' &&
    duplicate.verdict !== 'exact';

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittable) {
      save().catch(() => undefined);
    }
  };

  return (
    <form className={`${cardCompactClass} grid gap-3`} onSubmit={submit}>
      <TermDefinitionFields
        busy={busy}
        draft={draft}
        setDraft={setDraft}
        suggestDefinition={suggestDefinition}
        termRef={termRef}
      />
      {duplicate.verdict === 'none' ? null : (
        <p className="text-sm text-warning-foreground">
          {duplicate.verdict === 'exact'
            ? `${quoted(term)} ist schon eingetragen.`
            : `${quoted(term)} ist schon als ${quoted(duplicate.entry.targetText)} eingetragen.`}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button disabled={!submittable} type="submit">
          Eintragen
        </Button>
        <output
          aria-label="Status beim Eintragen eines Begriffs"
          className={failed ? 'text-destructive text-sm' : 'text-sm'}
        >
          {status}
        </output>
      </div>
    </form>
  );
};
