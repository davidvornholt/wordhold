import type { LanguageCode } from '@wordhold/db/schema/courses';
import { type SubmitEvent, useEffect, useId, useRef, useState } from 'react';
import type { LearnItem } from '../schemas/learning-models';
import { matchesLearnItem } from '../services/learn-check';
import { ManagedFocusHeading } from './managed-focus-heading';

type LearnEntryProps = {
  readonly item: LearnItem;
  readonly position: number;
  readonly total: number;
  readonly targetLanguage: LanguageCode;
  readonly targetLabel: string;
  // Records that this entry has been met. Only called once the learner has
  // written it correctly, and the next entry waits until it has been stored.
  readonly onLearned: () => Promise<void>;
};

// One entry of the learning pass. The answer starts as the field's prompt, then
// disappears once typing begins so the learner has to hold it in memory. Being
// wrong only asks again.
export const LearnEntry = ({
  item,
  position,
  total,
  targetLanguage,
  targetLabel,
  onLearned,
}: LearnEntryProps) => {
  const [typed, setTyped] = useState('');
  const [missed, setMissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const answerHintId = useId();
  const inputId = useId();
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
        <ManagedFocusHeading className="font-display text-xl">
          {item.nativeText}
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
        <label className="sr-only" htmlFor={inputId}>
          Schreib die Vokabel ab
        </label>
        {typed === '' ? (
          <span className="sr-only" id={answerHintId}>
            Vorlage: <span lang={targetLanguage}>{item.targetText}</span>
          </span>
        ) : null}
        <input
          aria-describedby={typed === '' ? answerHintId : undefined}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="border border-input bg-card px-3 py-2"
          disabled={busy}
          id={inputId}
          onChange={(event) => {
            setTyped(event.target.value);
            setSaveFailed(false);
          }}
          placeholder={item.targetText}
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
