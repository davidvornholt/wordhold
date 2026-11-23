import { maximumEntryTextLength } from '@wordhold/ai/extraction/schema';
import {
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  type SubmitEvent,
  useId,
  useRef,
  useState,
} from 'react';
import { courseNouns } from '../../../shared/directions';
import {
  entryTextLineClass,
  entryWordLineClass,
} from '../../../shared/ui/field-styles';
import { movesOnEnter } from '../../../shared/ui/submit-on-enter';
import { maximumMemorizedTextLength } from '../../../shared/vocabulary/entry-fields';
import type { VocabularyEntry } from '../schemas/course-units';
import { EditEntryFooter } from './edit-entry-footer';
import { type EntryEditorControl, useEntryEdit } from './entry-actions';
import { EntryCard } from './entry-card';
import { listEntryDuplicate } from './entry-duplicates';
import { type TextLookup, useTextSource } from './text-lookup';
import { TextLookupControls } from './text-lookup-controls';
import { missingField, useCloseRequest, useEntryCard } from './use-entry-card';
import { quoted } from './vocabulary-entry-draft';

export type TextDraft = {
  readonly title: string;
  readonly text: string;
};

type TextFieldsProps = {
  readonly draft: TextDraft;
  readonly setDraft: Dispatch<SetStateAction<TextDraft>>;
  readonly busy: boolean;
  readonly titleRef: RefObject<HTMLInputElement | null>;
  readonly textRef?: RefObject<HTMLTextAreaElement | null>;
  // What Enter in the title does instead of moving to the text, such as
  // looking the text up; it returns whether it did.
  readonly onTitleEnter?: () => boolean;
  // Shown below the title, such as the controls to look the text up.
  readonly titleAction?: ReactNode;
  // A note on the typed title, such as that it repeats a stored one.
  readonly hint: string | null;
};

// A title, such as a Bible reference, written on a line of its own, and the
// text learned under it on a line that grows as it is written. Enter on the
// title moves to the text while it is empty. Enter in the text starts a new
// line, since verses and poems keep their lines; the button files it.
const TextFields = ({
  draft,
  setDraft,
  busy,
  titleRef,
  textRef,
  onTitleEnter,
  titleAction,
  hint,
}: TextFieldsProps) => {
  const id = useId();
  const moves = draft.title.trim() !== '' && draft.text.trim() === '';
  const titleEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!(moves && movesOnEnter(event))) {
      return;
    }
    event.preventDefault();
    if (onTitleEnter?.() !== true) {
      textRef?.current?.focus();
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="eyebrow" htmlFor={`${id}-title`}>
          Titel
        </label>
        <input
          // biome-ignore lint/a11y/noAutofocus: The form appears on request; the learner asked to type, so the title takes focus.
          autoFocus={true}
          className={entryWordLineClass}
          disabled={busy}
          enterKeyHint={moves ? 'next' : undefined}
          id={`${id}-title`}
          maxLength={maximumEntryTextLength}
          onChange={(event) =>
            setDraft((current) => ({ ...current, title: event.target.value }))
          }
          onKeyDown={titleEnter}
          placeholder="z. B. Johannes 3,16"
          ref={titleRef}
          value={draft.title}
        />
        {hint === null ? null : (
          <p className="text-sm text-warning-foreground">{hint}</p>
        )}
      </div>
      {titleAction}
      <div className="flex flex-col gap-1">
        <label className="eyebrow" htmlFor={`${id}-text`}>
          Text
        </label>
        <textarea
          className={`${entryTextLineClass} field-sizing-content min-h-24 resize-none`}
          disabled={busy}
          id={`${id}-text`}
          maxLength={maximumMemorizedTextLength}
          onChange={(event) =>
            setDraft((current) => ({ ...current, text: event.target.value }))
          }
          ref={textRef}
          rows={3}
          value={draft.text}
        />
      </div>
    </div>
  );
};

const trimmed = (draft: TextDraft): TextDraft => ({
  title: draft.title.trim(),
  text: draft.text.trim(),
});

export type CreateText = (draft: TextDraft) => Promise<void>;

const emptyText: TextDraft = { title: '', text: '' };

type NewTextFormProps = {
  // Every stored text of the collection, so a repeated title is pointed out
  // while typing.
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly createEntry: CreateText;
  // Where a typed title can be looked up, or null when there is nowhere.
  readonly lookup: TextLookup | null;
};

// One text after another, each on a card of its own. A title that repeats a
// stored one exactly is stopped here; the same title in another casing is
// pointed out and left to the learner. With a Bible to look in, Enter in the
// title looks the text up while the text is still empty. A looked-up text
// fills the card and focus moves to "Eintragen", so Enter files it once it
// has been read.
export const NewTextForm = ({
  entries,
  createEntry,
  lookup,
}: NewTextFormProps) => {
  const titleRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const card = useEntryCard(emptyText, titleRef);
  const { draft, setDraft, busy } = card;
  const { sources, source, pick } = useTextSource(lookup);
  const { title, text } = trimmed(draft);
  const duplicate = listEntryDuplicate(entries, title, null);
  const submittable =
    !busy && title !== '' && text !== '' && !duplicate.blocked;
  const lookable = !busy && title !== '' && lookup !== null && source !== null;

  const lookUp = () => {
    if (!lookable) {
      return false;
    }
    card
      .run(
        `${quoted(title)} wird nachgeschlagen …`,
        async () => {
          const found = await lookup.lookUp(title, source.id);
          setDraft(found);
          return `${quoted(found.title)} nachgeschlagen. Lies den Text durch und trag ihn ein.`;
        },
        'Der Text wurde nicht nachgeschlagen. Versuche es noch einmal.',
        card.submitRef,
      )
      .catch(() => undefined);
    return true;
  };

  const save = () =>
    card.file({
      pending: `${quoted(title)} wird eingetragen …`,
      create: async () => {
        await createEntry({ title, text });
        return {
          entry: { front: title, back: text, frontLang: undefined, note: null },
          status: `${quoted(title)} eingetragen.`,
        };
      },
      fallback: 'Der Text wurde nicht eingetragen. Versuche es noch einmal.',
    });

  const requestClose = useCloseRequest(card, {
    blank: title === '' && text === '',
    missingRef: missingField([
      [title === '' || duplicate.blocked, titleRef],
      [text === '', textRef],
    ]),
    notice: 'Dieser Text ist noch nicht eingetragen.',
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
      enterFiles={false}
      nouns={courseNouns({ kind: 'texts' })}
      onSubmit={submit}
      requestClose={requestClose}
      statusLabel="Status beim Eintragen eines Texts"
      submittable={submittable}
    >
      <TextFields
        busy={busy}
        draft={draft}
        // While the entry is filed, the list may already hold it, and it
        // would be pointed out as a repeat of itself.
        hint={busy ? null : duplicate.hint}
        onTitleEnter={source === null ? undefined : lookUp}
        setDraft={setDraft}
        textRef={textRef}
        titleAction={
          source === null ? null : (
            <TextLookupControls
              disabled={!lookable}
              onLookUp={lookUp}
              pick={pick}
              source={source}
              sources={sources}
            />
          )
        }
        titleRef={titleRef}
      />
    </EntryCard>
  );
};

type EditTextFormProps = {
  readonly entry: VocabularyEntry;
  readonly control: EntryEditorControl;
  // Every text of the collection, which the corrected title is checked
  // against.
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly updateEntry: (draft: TextDraft) => Promise<void>;
};

// A title and its text, as stored, to correct. The card keeps its schedule.
export const EditTextForm = ({
  entry,
  control,
  entries,
  updateEntry,
}: EditTextFormProps) => {
  const [draft, setDraft] = useState<TextDraft>({
    title: entry.targetText,
    text: entry.nativeText,
  });
  const { busy, error, firstFieldRef, save } = useEntryEdit(
    control,
    'Der Text wurde nicht gespeichert. Versuche es noch einmal.',
  );
  const { title, text } = trimmed(draft);
  const duplicate = listEntryDuplicate(entries, title, entry.id);
  const submittable =
    !busy && title !== '' && text !== '' && !duplicate.blocked;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittable) {
      save(async () => {
        await updateEntry({ title, text });
        return `${quoted(title)} gespeichert.`;
      }).catch(() => undefined);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <TextFields
        busy={busy}
        draft={draft}
        hint={duplicate.hint}
        setDraft={setDraft}
        titleRef={firstFieldRef}
      />
      <EditEntryFooter
        busy={busy}
        error={error}
        onCancel={control.onCancel}
        submittable={submittable}
      />
    </form>
  );
};
