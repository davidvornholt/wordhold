import { type SubmitEvent, useRef } from 'react';
import { courseNouns } from '../../../shared/directions';
import type { VocabularyEntry } from '../schemas/course-units';
import { EntryCard } from './entry-card';
import { listEntryDuplicate } from './entry-duplicates';
import {
  type SuggestDefinition,
  TermDefinitionFields,
  type TermDraft,
} from './term-definition-fields';
import { missingField, useCloseRequest, useEntryCard } from './use-entry-card';
import { quoted } from './vocabulary-entry-draft';

export type CreateTerm = (draft: TermDraft) => Promise<void>;

type NewTermFormProps = {
  // Every stored term of the subject, so a repeat is pointed out while
  // typing.
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly createEntry: CreateTerm;
  readonly suggestDefinition: SuggestDefinition;
};

const emptyTerm: TermDraft = { term: '', definition: '' };

// One term after another, each on a card of its own. An exact repeat of a
// stored term is stopped here; the same term in another casing is pointed
// out and left to the learner.
export const NewTermForm = ({
  entries,
  createEntry,
  suggestDefinition,
}: NewTermFormProps) => {
  const termRef = useRef<HTMLInputElement>(null);
  const definitionRef = useRef<HTMLTextAreaElement>(null);
  const card = useEntryCard(emptyTerm, termRef);
  const { draft, setDraft, busy } = card;
  const term = draft.term.trim();
  const definition = draft.definition.trim();
  const duplicate = listEntryDuplicate(entries, term, null);
  const submittable =
    !busy && term !== '' && definition !== '' && !duplicate.blocked;

  const save = () =>
    card.file({
      pending: `${quoted(term)} wird eingetragen …`,
      create: async () => {
        await createEntry({ term, definition });
        return {
          entry: {
            front: term,
            back: definition,
            frontLang: undefined,
            note: null,
          },
          status: `${quoted(term)} eingetragen.`,
        };
      },
      fallback: 'Der Begriff wurde nicht eingetragen. Versuche es noch einmal.',
    });

  const requestClose = useCloseRequest(card, {
    blank: term === '' && definition === '',
    missingRef: missingField([
      [term === '' || duplicate.blocked, termRef],
      [definition === '', definitionRef],
    ]),
    notice: 'Dieser Begriff ist noch nicht eingetragen.',
  });

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittable) {
      save().catch(() => undefined);
    }
  };

  return (
    <EntryCard
      card={card}
      enterFiles={true}
      nouns={courseNouns({ kind: 'terms' })}
      onSubmit={submit}
      requestClose={requestClose}
      statusLabel="Status beim Eintragen eines Begriffs"
      submittable={submittable}
    >
      <TermDefinitionFields
        busy={busy}
        definitionRef={definitionRef}
        draft={draft}
        // While the entry is filed, the list may already hold it, and it
        // would be pointed out as a repeat of itself.
        hint={busy ? null : duplicate.hint}
        reviewStep="Eintragen"
        setDraft={setDraft}
        suggestDefinition={suggestDefinition}
        termRef={termRef}
      />
    </EntryCard>
  );
};
