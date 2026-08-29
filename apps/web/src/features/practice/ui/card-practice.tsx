import type { ReviewMode } from '@wordhold/db/schema/practice';
import { type SubmitEvent, useEffect, useRef, useState } from 'react';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import type {
  PracticeSession,
  SubmitResult,
} from '../services/practice-service';
import { FeedbackPanel } from './feedback-panel';

type SessionItem = PracticeSession['items'][number];

type CardPracticeProps = {
  readonly item: SessionItem;
  // Whether this card was already missed earlier in the same session.
  readonly repeated: boolean;
  readonly targetLabel: string;
  // Which sitting produced the answer. The server stores this as provenance
  // only. Stored card state and due date decide whether scheduling advances.
  readonly mode: ReviewMode;
  readonly submit: (input: {
    readonly data: SubmitPayloadData;
  }) => Promise<SubmitResult>;
  // Hands the graded result to the session, which decides whether the card is
  // done with or comes back later.
  readonly onNext: (result: SubmitResult) => void;
};

// One card's answer round-trip. Mounted with a key that changes per attempt so
// answer state and the elapsed-time clock reset each time the card is asked.
export const CardPractice = ({
  item,
  repeated,
  targetLabel,
  mode,
  submit,
  onNext,
}: CardPracticeProps) => {
  const answerInput = useRef<HTMLInputElement>(null);
  const [answer, setAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null);
  const [startedAt] = useState(() => performance.now());
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioUrl = item.hasAudio ? `/api/entries/${item.entryId}/audio` : null;

  useEffect(() => {
    if (busy || result !== null) {
      return;
    }
    const focusTask = globalThis.setTimeout(() => answerInput.current?.focus());
    return () => globalThis.clearTimeout(focusTask);
  }, [busy, result]);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || result !== null) {
      return;
    }
    const answerSnapshot = answer;
    setSubmittedAnswer(answerSnapshot);
    setBusy(true);
    setError(null);
    try {
      const submitted = await submit({
        data: {
          cardId: item.cardId,
          revision: item.revision,
          answer: answerSnapshot,
          elapsedMs: Math.floor(performance.now() - startedAt),
          mode,
        },
      });
      setResult(submitted);
      if (audioUrl !== null) {
        await new Audio(audioUrl).play().catch(() => undefined);
      }
    } catch (cause) {
      setSubmittedAnswer(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {item.direction === 'to_target'
          ? `Übersetze ins ${targetLabel}e`
          : 'Übersetze ins Deutsche'}
        {repeated ? ' · Noch einmal' : null}
      </p>
      <div className="border border-border bg-card p-6">
        <h2 className="font-display text-xl">{item.prompt}</h2>
      </div>
      <form
        aria-busy={busy}
        className="flex flex-col gap-3"
        onSubmit={onSubmit}
      >
        <input
          aria-label="Deine Antwort"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="border border-input bg-card px-3 py-2"
          disabled={busy || result !== null}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Deine Antwort"
          ref={answerInput}
          value={submittedAnswer ?? answer}
        />
        {result === null ? (
          <button
            className="bg-primary px-4 py-2 text-primary-foreground text-sm disabled:opacity-50"
            disabled={busy || answer.trim() === ''}
            type="submit"
          >
            {busy ? 'Wird geprüft …' : 'Prüfen'}
          </button>
        ) : null}
      </form>
      {error === null ? null : (
        <p className="text-destructive text-sm">{error}</p>
      )}
      {result === null ? null : (
        <FeedbackPanel
          audioUrl={audioUrl}
          onNext={() => onNext(result)}
          result={result}
        />
      )}
    </>
  );
};
