import { maximumEntryTextLength } from '@wordhold/ai/extraction/schema';
import {
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  type SubmitEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button } from '../../../shared/ui/button';
import { fieldOnCardClass } from '../../../shared/ui/field-styles';
import { maximumMemorizedTextLength } from '../../../shared/vocabulary/entry-fields';
import type { VocabularyEntry } from '../schemas/course-units';
import { EditEntryFooter } from './edit-entry-footer';
import { type EntryEditorControl, useEntryEdit } from './entry-actions';
import { listEntryDuplicate } from './entry-duplicates';
import { type TextLookup, useTextSource } from './text-lookup';
import { TextLookupControls } from './text-lookup-controls';
import { quoted } from './use-new-vocabulary-entry';

export type TextDraft = {
  readonly title: string;
  readonly text: string;
};

type TextFieldsProps = {
  readonly draft: TextDraft;
  readonly setDraft: Dispatch<SetStateAction<TextDraft>>;
  readonly busy: boolean;
  readonly titleRef: RefObject<HTMLInputElement | null>;
  readonly onTitleKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  // Shown below the title, such as the controls to look the text up.
  readonly titleAction?: ReactNode;
};

// A title, such as a Bible reference, and the text learned under it. Enter
// starts a new line of the text, since verses and poems keep their lines;
// the button saves.
const TextFields = ({
  draft,
  setDraft,
  busy,
  titleRef,
  onTitleKeyDown,
  titleAction,
}: TextFieldsProps) => (
  <div className="grid gap-3">
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Titel</span>
      <input
        // biome-ignore lint/a11y/noAutofocus: The form appears on request; the learner asked to type, so the title takes focus.
        autoFocus={true}
        className={fieldOnCardClass}
        disabled={busy}
        maxLength={maximumEntryTextLength}
        onChange={(event) =>
          setDraft((current) => ({ ...current, title: event.target.value }))
        }
        onKeyDown={onTitleKeyDown}
        placeholder="z. B. Johannes 3,16"
        ref={titleRef}
        value={draft.title}
      />
    </label>
    {titleAction}
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Text</span>
      <textarea
        className={`${fieldOnCardClass} field-sizing-content min-h-32 resize-none`}
        disabled={busy}
        maxLength={maximumMemorizedTextLength}
        onChange={(event) =>
          setDraft((current) => ({ ...current, text: event.target.value }))
        }
        rows={5}
        value={draft.text}
      />
    </label>
  </div>
);

const trimmed = (draft: TextDraft): TextDraft => ({
  title: draft.title.trim(),
  text: draft.text.trim(),
});

export type CreateText = (draft: TextDraft) => Promise<void>;

const emptyText: TextDraft = { title: '', text: '' };

const failureMessage = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback;

// Saving or looking up one text: the fields are disabled meanwhile. A saved
// text clears the form and focus returns to the title, so the next text can
// be typed right away. A looked-up text fills the form and focus moves to
// the button that saves it, so Enter saves it once it has been read.
const useNewTextEntry = (createEntry: CreateText) => {
  const [draft, setDraft] = useState(emptyText);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const focusRef = useRef<'title' | 'save' | null>(null);

  useEffect(() => {
    if (busy || focusRef.current === null) {
      return;
    }
    const save = saveRef.current;
    if (focusRef.current === 'save' && save !== null && !save.disabled) {
      save.focus();
    } else {
      titleRef.current?.focus();
    }
    focusRef.current = null;
  }, [busy]);

  const run = async (
    pending: string,
    work: () => Promise<string>,
    fallback: string,
  ) => {
    setBusy(true);
    setFailed(false);
    setStatus(pending);
    try {
      setStatus(await work());
    } catch (cause) {
      setFailed(true);
      setStatus(failureMessage(cause, fallback));
      focusRef.current = 'title';
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const text = trimmed(draft);
    return run(
      `${quoted(text.title)} wird eingetragen …`,
      async () => {
        await createEntry(text);
        setDraft(emptyText);
        focusRef.current = 'title';
        return `${quoted(text.title)} eingetragen.`;
      },
      'Der Text wurde nicht eingetragen. Versuche es noch einmal.',
    );
  };

  const lookUp = (lookup: TextLookup, sourceId: string) => {
    const title = draft.title.trim();
    return run(
      `${quoted(title)} wird nachgeschlagen …`,
      async () => {
        const found = await lookup.lookUp(title, sourceId);
        setDraft(found);
        focusRef.current = 'save';
        return `${quoted(found.title)} nachgeschlagen. Lies den Text durch und trag ihn ein.`;
      },
      'Der Text wurde nicht nachgeschlagen. Versuche es noch einmal.',
    );
  };

  return {
    draft,
    setDraft,
    busy,
    failed,
    status,
    titleRef,
    saveRef,
    save,
    lookUp,
  } as const;
};

type NewTextFormProps = {
  // Every stored text of the collection, so a repeated title is pointed out
  // while typing.
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly createEntry: CreateText;
  // Where a typed title can be looked up, or null when there is nowhere.
  readonly lookup: TextLookup | null;
};

// One text at a time, for as long as the form stays open. A title that
// repeats a stored one exactly is stopped here; the same title in another
// casing is pointed out and left to the learner. With a Bible to look in,
// Enter in the title looks the text up while the text is still empty.
export const NewTextForm = ({
  entries,
  createEntry,
  lookup,
}: NewTextFormProps) => {
  const entry = useNewTextEntry(createEntry);
  const { draft, setDraft, busy, failed, status } = entry;
  const { sources, source, pick } = useTextSource(lookup);
  const { title, text } = trimmed(draft);
  const duplicate = listEntryDuplicate(entries, title, null);
  const submittable =
    !busy && title !== '' && text !== '' && !duplicate.blocked;
  const lookable = !busy && title !== '' && lookup !== null && source !== null;

  const lookUp = () => {
    if (lookable) {
      entry.lookUp(lookup, source.id).catch(() => undefined);
    }
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittable) {
      entry.save().catch(() => undefined);
    }
  };

  const lookUpOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key === 'Enter' &&
      !event.nativeEvent.isComposing &&
      text === ''
    ) {
      event.preventDefault();
      lookUp();
    }
  };

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <TextFields
        busy={busy}
        draft={draft}
        onTitleKeyDown={source === null ? undefined : lookUpOnEnter}
        setDraft={setDraft}
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
        titleRef={entry.titleRef}
      />
      {duplicate.hint === null ? null : (
        <p className="text-sm text-warning-foreground">{duplicate.hint}</p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button disabled={!submittable} ref={entry.saveRef} type="submit">
          Eintragen
        </Button>
        <output
          aria-label="Status beim Eintragen eines Texts"
          className={failed ? 'text-destructive text-sm' : 'text-sm'}
        >
          {status}
        </output>
      </div>
    </form>
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
    <form className="grid gap-3" onSubmit={submit}>
      <TextFields
        busy={busy}
        draft={draft}
        setDraft={setDraft}
        titleRef={firstFieldRef}
      />
      {duplicate.hint === null ? null : (
        <p className="text-sm text-warning-foreground">{duplicate.hint}</p>
      )}
      <EditEntryFooter
        busy={busy}
        error={error}
        onCancel={control.onCancel}
        submittable={submittable}
      />
    </form>
  );
};
