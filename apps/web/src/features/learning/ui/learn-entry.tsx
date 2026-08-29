import type { LanguageCode } from '@wordhold/db/schema/courses';
import { type SubmitEvent, useEffect, useId, useRef, useState } from 'react';
import { directionLabel } from '../../../shared/directions';
import {
  type LearnItem,
  learnAnswer,
  learnPrompt,
} from '../schemas/learning-models';
import { matchesLearnItem } from '../services/learn-check';

type LearnEntryProps = {
  readonly item: LearnItem;
  readonly targetLanguage: LanguageCode;
  readonly targetLabel: string;
  // Records that this direction has been met. Only called once the learner has
  // written it correctly, and the next direction waits until it has been stored.
  readonly onLearned: () => Promise<void>;
};

// One direction of the learning pass. The answer starts as the field's prompt, then
// disappears once typing begins so the learner has to hold it in memory. Being
// wrong only asks again.
export const LearnEntry = ({
  item,
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
  const promptId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const answer = learnAnswer(item);
  const prompt = learnPrompt(item);
  const answerLanguage = item.direction === 'to_target' ? targetLanguage : 'de';
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
    if (busy) {
      return;
    }
    const focusTask = globalThis.setTimeout(() => inputRef.current?.focus());
    return () => globalThis.clearTimeout(focusTask);
  }, [busy]);

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
      inputRef.current?.focus();
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
      <div className="flex flex-col gap-2 border border-border bg-card p-6">
        <h2 className="font-display text-xl" id={promptId}>
          {prompt}
        </h2>
        <p className="text-muted-foreground text-sm">
          {directionLabel(item.direction, targetLabel)}
        </p>
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
          Schreib die Antwort
        </label>
        {typed === '' ? (
          <span className="sr-only" id={answerHintId}>
            Vorlage: <span lang={answerLanguage}>{answer}</span>
          </span>
        ) : null}
        <input
          aria-describedby={
            typed === '' ? `${promptId} ${answerHintId}` : promptId
          }
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="min-h-11 border border-input bg-card px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
          disabled={busy}
          id={inputId}
          onChange={(event) => {
            setTyped(event.target.value);
            setSaveFailed(false);
          }}
          placeholder={answer}
          ref={inputRef}
          value={typed}
        />
        <button
          className="min-h-11 bg-primary px-4 py-2 text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          disabled={busy || typed.trim() === ''}
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
