import { useEffect, useRef } from 'react';
import type { SubmitResult } from '../services/practice-service';

const panelTone = (result: SubmitResult) => {
  if (!result.graded) {
    return 'border-warning-foreground bg-warning';
  }
  return result.correct
    ? 'border-primary bg-accent'
    : 'border-destructive bg-destructive/10';
};

type FeedbackPanelProps = {
  readonly result: SubmitResult;
  readonly audioUrl: string | null;
  readonly onNext: () => void;
};

export const FeedbackPanel = ({
  result,
  audioUrl,
  onNext,
}: FeedbackPanelProps) => {
  const nextButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    nextButton.current?.focus();
  }, []);

  return (
    <div className={`flex flex-col gap-3 border-l-4 p-4 ${panelTone(result)}`}>
      {result.graded ? (
        <p className="font-medium">
          {result.correct ? 'Richtig!' : 'Leider falsch.'}
        </p>
      ) : (
        <p className="font-medium">{result.message}</p>
      )}
      <p className="text-sm">
        Erwartet:{' '}
        <span className="font-medium">
          {result.expectedAnswers.join(' / ')}
        </span>
      </p>
      {result.graded && result.explanation !== null ? (
        <p className="text-sm">{result.explanation}</p>
      ) : null}
      {result.graded && result.acceptedAsAlternative ? (
        <p className="text-accent-foreground text-sm">
          Deine Antwort wurde als gültige Alternative gespeichert.
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        {audioUrl === null ? null : (
          <button
            className="border border-input px-3 py-1.5 text-sm"
            onClick={async () => {
              await new Audio(audioUrl).play().catch(() => undefined);
            }}
            type="button"
          >
            Aussprache anhören
          </button>
        )}
        <button
          className="bg-primary px-4 py-1.5 text-primary-foreground text-sm"
          onClick={onNext}
          ref={nextButton}
          type="button"
        >
          Weiter
        </button>
      </div>
    </div>
  );
};
