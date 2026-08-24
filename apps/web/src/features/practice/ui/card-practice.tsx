import { type SubmitEvent, useState } from 'react';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import type {
  PracticeSession,
  SubmitResult,
} from '../services/practice-service';
import { FeedbackPanel } from './feedback-panel';

type SessionItem = PracticeSession['items'][number];

type CardPracticeProps = {
  readonly item: SessionItem;
  readonly position: number;
  readonly total: number;
  readonly targetLabel: string;
  readonly submit: (input: {
    readonly data: SubmitPayloadData;
  }) => Promise<SubmitResult>;
  // Called with the grading result: true/false when graded, null when the
  // judge was unreachable and the card stayed untouched.
  readonly onNext: (correct: boolean | null) => void;
};

// One card's answer round-trip. Mounted with key=cardId so answer state and
// the elapsed-time clock reset per card.
export const CardPractice = ({
  item,
  position,
  total,
  targetLabel,
  submit,
  onNext,
}: CardPracticeProps) => {
  const [answer, setAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null);
  const [startedAt] = useState(() => performance.now());
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioUrl = item.hasAudio ? `/api/entries/${item.entryId}/audio` : null;

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
        Karte {position} von {total} ·{' '}
        {item.direction === 'to_target'
          ? `Übersetze ins ${targetLabel}e`
          : 'Übersetze ins Deutsche'}
      </p>
      <div className="border border-border bg-card p-6">
        <p className="font-display text-2xl">{item.prompt}</p>
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
          onNext={() => onNext(result.graded ? result.correct : null)}
          result={result}
        />
      )}
    </>
  );
};
