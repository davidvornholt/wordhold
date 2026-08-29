import { type SubmitEvent, useEffect, useRef, useState } from 'react';
import type { LearnItem } from '../schemas/learning-models';
import { matchesLearnItem } from '../services/learn-check';
import { ManagedFocusHeading } from './managed-focus-heading';

type LearnEntryProps = {
  readonly item: LearnItem;
  readonly position: number;
  readonly total: number;
  readonly targetLabel: string;
  // Records that this entry has been met. Only called once the learner has
  // written it correctly, and the next entry waits until it has been stored.
  readonly onLearned: () => Promise<void>;
};

// One entry of the learning pass. The entry is on screen the whole time: this is
// where you meet it, so there is nothing to recall and nothing to grade. Being
// wrong only asks again.
export const LearnEntry = ({
  item,
  position,
  total,
  targetLabel,
  onLearned,
}: LearnEntryProps) => {
  const [typed, setTyped] = useState('');
  const [missed, setMissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const audioUrl = item.hasAudio ? `/api/entries/${item.entryId}/audio` : null;
  const play = async () => {
    if (audioUrl !== null) {
      await new Audio(audioUrl).play().catch(() => undefined);
    }
  };

  // Hearing the entry is half of meeting it, so it plays on arrival. A browser
  // that blocks unprompted audio leaves the button as the way in.
  useEffect(() => {
    if (audioUrl === null) {
      return;
    }
    new Audio(audioUrl).play().catch(() => undefined);
  }, [audioUrl]);

  useEffect(() => {
    if (saveFailed && !busy) {
      actionRef.current?.focus();
    }
  }, [busy, saveFailed]);

  useEffect(() => {
    if (missed && typed === '') {
      inputRef.current?.focus();
    }
  }, [missed, typed]);

  let actionLabel = 'Weiter';
  if (busy) {
    actionLabel = 'Wird gespeichert …';
  } else if (saveFailed) {
    actionLabel = 'Erneut versuchen';
  }

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    if (!matchesLearnItem(item, typed)) {
      setSaveFailed(false);
      setMissed(true);
      setTyped('');
      return;
    }
    setMissed(false);
    setBusy(true);
    setSaveFailed(false);
    try {
      await onLearned();
    } catch {
      setSaveFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="text-muted-foreground text-sm">
        Vokabel {position} von {total}
      </p>
      <div className="flex flex-col gap-2 border border-border bg-card p-6">
        <p className="text-lg">{item.nativeText}</p>
        <ManagedFocusHeading className="font-display text-xl">
          {item.targetText}
        </ManagedFocusHeading>
        <p className="text-muted-foreground text-sm">{targetLabel}</p>
        {audioUrl === null ? null : (
          <button
            className="w-fit text-sm underline"
            onClick={play}
            type="button"
          >
            Aussprache anhören
          </button>
        )}
      </div>
      <form
        aria-busy={busy}
        className="flex flex-col gap-3"
        onSubmit={onSubmit}
      >
        <input
          aria-label="Schreib die Vokabel ab"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="border border-input bg-card px-3 py-2"
          disabled={busy}
          onChange={(event) => {
            setTyped(event.target.value);
            setSaveFailed(false);
          }}
          placeholder="Schreib die Vokabel ab"
          ref={inputRef}
          value={typed}
        />
        <button
          className="bg-primary px-4 py-2 text-primary-foreground text-sm disabled:opacity-50"
          disabled={busy || typed.trim() === ''}
          ref={actionRef}
          type="submit"
        >
          {actionLabel}
        </button>
      </form>
      <p aria-live="polite" className="text-sm">
        {missed ? 'Noch nicht ganz. Schreib die Vokabel genau so ab.' : null}
      </p>
      {saveFailed ? (
        <p className="text-destructive text-sm" role="alert">
          Die Vokabel wurde nicht gespeichert. Versuch es noch einmal.
        </p>
      ) : null}
    </>
  );
};
