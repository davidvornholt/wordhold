import { useEffect, useId, useRef } from 'react';
import { normalizeAnswer } from '../../../shared/grading/normalize';
import type { WrongAnswerResolution } from '../schemas/submission-schema';
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
  readonly submittedAnswer: string;
  readonly audioUrl: string | null;
  readonly onNext: () => void;
  readonly onResolveWrong: (
    resolution: Exclude<WrongAnswerResolution, 'defer'>,
  ) => void;
  readonly resolution: Exclude<WrongAnswerResolution, 'defer'> | null;
};

export const FeedbackPanel = ({
  result,
  submittedAnswer,
  audioUrl,
  onNext,
  onResolveWrong,
  resolution,
}: FeedbackPanelProps) => {
  const normalizedSubmission = normalizeAnswer(submittedAnswer);
  const repeatsSubmittedAnswer = result.expectedAnswers.some(
    (expectedAnswer) =>
      normalizeAnswer(expectedAnswer) === normalizedSubmission,
  );
  const nextButton = useRef<HTMLButtonElement>(null);
  const feedbackDescriptionId = useId();
  const pendingWrong = result.graded && !result.stored;

  useEffect(() => {
    nextButton.current?.focus();
  }, []);

  return (
    <div
      aria-busy={resolution !== null}
      className={`flex flex-col gap-3 border-l-4 p-4 ${panelTone(result)}`}
    >
      <div
        aria-live="polite"
        className="flex flex-col gap-3"
        id={feedbackDescriptionId}
        role="status"
      >
        {result.graded ? (
          <p className="font-medium">
            {result.correct ? 'Richtig!' : 'Leider falsch.'}
          </p>
        ) : (
          <p className="font-medium">{result.message}</p>
        )}
        {repeatsSubmittedAnswer ? null : (
          <p className="text-sm">
            Erwartet:{' '}
            <span className="font-medium">
              {result.expectedAnswers.join(' / ')}
            </span>
          </p>
        )}
        {result.graded && result.explanation !== null ? (
          <p className="text-sm">{result.explanation}</p>
        ) : null}
        {result.graded && result.acceptedAsAlternative ? (
          <p className="text-accent-foreground text-sm">
            Deine Antwort wurde als gültige Alternative gespeichert.
          </p>
        ) : null}
        {pendingWrong ? (
          <p className="text-sm">
            Vertippt oder falsch bewertet? Du kannst die Antwort als richtig
            werten. Sie zählt dann als schwer, wird aber nicht als Lösung
            gespeichert.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
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
        {pendingWrong ? (
          <button
            className="border border-input px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={resolution !== null}
            onClick={() => onResolveWrong('hard')}
            type="button"
          >
            {resolution === 'hard'
              ? 'Wird gespeichert …'
              : 'Als richtig werten'}
          </button>
        ) : null}
        <button
          className="bg-primary px-4 py-1.5 text-primary-foreground text-sm disabled:opacity-50"
          aria-describedby={feedbackDescriptionId}
          disabled={resolution !== null}
          onClick={() => {
            if (pendingWrong) {
              onResolveWrong('again');
            } else {
              onNext();
            }
          }}
          ref={nextButton}
          type="button"
        >
          {resolution === 'again' ? 'Wird gespeichert …' : 'Weiter'}
        </button>
      </div>
    </div>
  );
};
