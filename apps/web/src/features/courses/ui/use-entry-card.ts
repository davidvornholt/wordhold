import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { fileCard } from '../../../shared/ui/card-transition';
import { useEntryDialog } from './entry-dialog-context';

export type FiledEntry = {
  // The entry as its row shows it: a word and its translation, a term and its
  // definition, or a title and its text.
  readonly front: string;
  readonly back: string;
  readonly frontLang: string | undefined;
  // What went wrong besides, such as a pronunciation that was not made.
  readonly note: string | null;
};

// A filed entry in the order it was filed, which tells the rows apart.
type FiledRow = FiledEntry & { readonly key: number };

export type Filing = {
  readonly entry: FiledEntry;
  // What the status says once the entry is filed.
  readonly status: string;
};

type FileInput = {
  readonly pending: string;
  readonly create: () => Promise<Filing>;
  // The status when saving fails with no message of its own.
  readonly fallback: string;
};

const failureMessage = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback;

// The card new entries are typed on, one after another, and the entries filed
// from it while the dialog is open. The fields are disabled while an entry is
// saved. A filed entry leaves for the list below the card, which starts blank
// again, with focus back in its first field. An entry that fails to be filed
// gives focus back to where it was, so it can be filed again from there.
export const useEntryCard = <Draft>(
  empty: Draft,
  firstFieldRef: RefObject<HTMLElement | null>,
) => {
  const submitRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('');
  const [filed, setFiled] = useState<ReadonlyArray<FiledRow>>([]);
  // The draft "Schließen" found typed. It stays held, and "Schließen" offers
  // to discard it, until it changes.
  const [heldDraft, setHeldDraft] = useState<Draft | null>(null);
  // Where focus goes once the fields are enabled again.
  const focusRef = useRef<(() => HTMLElement | null) | null>(null);

  // A target that stays disabled, such as "Eintragen" for a looked-up text
  // that repeats a stored one, leaves focus to the first field.
  useEffect(() => {
    const target = focusRef.current;
    if (busy || target === null) {
      return;
    }
    focusRef.current = null;
    const element = target();
    if (element?.matches(':disabled') === false) {
      element.focus();
    } else {
      firstFieldRef.current?.focus();
    }
  }, [busy, firstFieldRef]);

  const start = (pending: string) => {
    const before = document.activeElement;
    focusRef.current = () => (before instanceof HTMLElement ? before : null);
    setBusy(true);
    setFailed(false);
    setStatus(pending);
  };

  const fail = (cause: unknown, fallback: string) => {
    setFailed(true);
    setStatus(failureMessage(cause, fallback));
    setBusy(false);
  };

  // Work on the card that is not filing, such as looking a text up from its
  // title. Focus then moves to `focus`, or back to the first field when the
  // work fails, since what it started from is what to correct.
  const run = async (
    pending: string,
    work: () => Promise<string>,
    fallback: string,
    focus: RefObject<HTMLElement | null>,
  ) => {
    start(pending);
    try {
      const done = await work();
      setStatus(done);
      focusRef.current = () => focus.current;
      setBusy(false);
    } catch (cause) {
      focusRef.current = () => firstFieldRef.current;
      fail(cause, fallback);
    }
  };

  const file = async ({ pending, create, fallback }: FileInput) => {
    start(pending);
    let filing: Filing;
    try {
      filing = await create();
    } catch (cause) {
      fail(cause, fallback);
      return;
    }
    fileCard(() => {
      setDraft(empty);
      setFiled((current) => [
        { ...filing.entry, key: current.length },
        ...current,
      ]);
      setStatus(filing.status);
      focusRef.current = () => firstFieldRef.current;
      setBusy(false);
    });
  };

  const hold = (notice: string) => {
    setHeldDraft(draft);
    setFailed(false);
    setStatus(notice);
  };

  return {
    draft,
    setDraft,
    busy,
    failed,
    status,
    filed,
    held: heldDraft === draft,
    submitRef,
    run,
    file,
    hold,
  } as const;
};

export type EntryCardState<Draft> = ReturnType<typeof useEntryCard<Draft>>;

type CloseRequestInput = {
  // Whether nothing has been typed on the card.
  readonly blank: boolean;
  // The field to complete, or null when the entry can be filed as it is.
  readonly missingRef: RefObject<HTMLElement | null> | null;
  // Says the entry is not filed yet, such as "Diese Vokabel ist noch nicht
  // eingetragen."
  readonly notice: string;
};

// The first field still to write, each given with whether it is, or null
// when the entry can be filed.
export const missingField = (
  fields: ReadonlyArray<
    readonly [missing: boolean, ref: RefObject<HTMLElement | null>]
  >,
) => fields.find(([missing]) => missing)?.[1] ?? null;

// "Schließen", and Escape with it, only ever closes; filing is "Eintragen"
// alone, so each button means one thing. A blank card closes at once. A typed
// one is held instead, with focus where it can be finished: in the field to
// complete, or on "Eintragen". "Schließen" turns into "Verwerfen" meanwhile,
// which discards the entry and closes.
export const useCloseRequest = <Draft>(
  card: EntryCardState<Draft>,
  { blank, missingRef, notice }: CloseRequestInput,
) => {
  const { close, requestCloseRef } = useEntryDialog();
  const requestClose = () => {
    if (card.busy) {
      return;
    }
    if (blank || card.held) {
      close();
    } else {
      card.hold(notice);
      (missingRef ?? card.submitRef).current?.focus();
    }
  };
  // The dialog calls the latest request on Escape, which needs this render's
  // draft.
  useLayoutEffect(() => {
    requestCloseRef.current = requestClose;
    return () => {
      requestCloseRef.current = null;
    };
  });
  return requestClose;
};
