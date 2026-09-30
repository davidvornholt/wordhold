import { type SubmitEvent, useState } from 'react';
import type { VocabularyEntry } from '../schemas/course-units';
import { EditEntryFooter } from './edit-entry-footer';
import { type EntryEditorControl, useEntryEdit } from './entry-actions';
import { termDuplicate } from './entry-duplicates';
import {
  type SuggestDefinition,
  TermDefinitionFields,
  type TermDraft,
} from './term-definition-fields';
import { quoted } from './use-new-vocabulary-entry';

type EditTermFormProps = {
  readonly entry: VocabularyEntry;
  readonly control: EntryEditorControl;
  // Every term of the subject, which the corrected term is checked against.
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly updateEntry: (draft: TermDraft) => Promise<void>;
  readonly suggestDefinition: SuggestDefinition;
};

// A term and its definition, as stored, to correct. Like a typed term, an
// exact repeat of another stored term is stopped here and the same term in
// another casing is pointed out.
export const EditTermForm = ({
  entry,
  control,
  entries,
  updateEntry,
  suggestDefinition,
}: EditTermFormProps) => {
  const [draft, setDraft] = useState<TermDraft>({
    term: entry.targetText,
    definition: entry.nativeText,
  });
  const { busy, error, firstFieldRef, save } = useEntryEdit(
    control,
    'Der Begriff wurde nicht gespeichert. Versuche es noch einmal.',
  );
  const term = draft.term.trim();
  const definition = draft.definition.trim();
  const duplicate = termDuplicate(entries, term, entry.id);
  const submittable =
    !busy && term !== '' && definition !== '' && !duplicate.blocked;
  // Key points state what the old definition said, so they are derived anew.
  const keyPointsReset =
    entry.keyPoints !== null && definition !== entry.nativeText;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittable) {
      save(async () => {
        await updateEntry({ term, definition });
        return `${quoted(term)} gespeichert.`;
      }).catch(() => undefined);
    }
  };

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <TermDefinitionFields
        busy={busy}
        draft={draft}
        reviewStep="Speichern"
        setDraft={setDraft}
        suggestDefinition={suggestDefinition}
        termRef={firstFieldRef}
      />
      {duplicate.hint === null ? null : (
        <p className="text-sm text-warning-foreground">{duplicate.hint}</p>
      )}
      {keyPointsReset ? (
        <p className="text-muted-foreground text-xs">
          Mit der neuen Definition werden die Kernpunkte neu abgeleitet.
        </p>
      ) : null}
      <EditEntryFooter
        busy={busy}
        error={error}
        onCancel={control.onCancel}
        submittable={submittable}
      />
    </form>
  );
};
