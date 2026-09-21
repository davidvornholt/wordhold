import type { LanguageCode } from '@wordhold/db/schema/courses';
import { type SubmitEvent, useEffect, useId, useRef, useState } from 'react';
import { directionLabel } from '../../../shared/directions';
import { Button } from '../../../shared/ui/button';
import { answerFieldClass } from '../../../shared/ui/field-styles';
import { WordCard } from '../../../shared/ui/word-card';
import {
  type LearnItem,
  learnAnswer,
  learnPrompt,
} from '../schemas/learning-models';
import { matchesLearnItem } from '../services/learn-check';
import { LearnExampleAudio } from './learn-example-audio';

type LearnEntryProps = {
  readonly item: LearnItem;
  // Entries still waiting behind this one in the section.
  readonly deck: number;
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
  deck,
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
      <WordCard
        deck={deck}
        eyebrow={directionLabel(item.direction, targetLabel)}
        tone={missed ? 'warning' : 'neutral'}
        word={prompt}
        wordId={promptId}
        wordLang={item.direction === 'to_native' ? targetLanguage : undefined}
      >
        <LearnExampleAudio item={item} targetLanguage={targetLanguage} />
      </WordCard>
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
          className={`${answerFieldClass} ${
            missed ? 'border-warning-foreground' : 'border-input'
          }`}
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
        <Button disabled={busy || typed.trim() === ''} type="submit">
          {actionLabel}
        </Button>
      </form>
      <p aria-live="polite" className="text-center text-sm">
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
