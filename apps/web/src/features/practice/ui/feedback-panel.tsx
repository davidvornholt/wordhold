import { useEffect, useId, useRef } from 'react';
import { formatLearningDate } from '../../../shared/dates/learning-date';
import { normalizeAnswer } from '../../../shared/grading/normalize';
import type { SubmitResult } from '../schemas/practice-models';
import type { WrongAnswerResolution } from '../schemas/submission-schema';

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
  readonly repeated: boolean;
  readonly resolution: Exclude<WrongAnswerResolution, 'defer'> | null;
};

const feedbackHeading = (result: SubmitResult, repeated: boolean): string => {
  if (!result.graded) {
    return result.message;
  }
  if (!result.correct) {
    return 'Noch nicht sicher';
  }
  return repeated ? 'Diesmal richtig' : 'Richtig';
};

const scheduleLead = (
  result: Extract<
    SubmitResult,
    { readonly graded: true; readonly stored: true }
  >,
  repeated: boolean,
) => {
  if (!result.correct) {
    return 'Erneut festigen ';
  }
  if (!result.schedule.advanced) {
    return 'Zusätzliche Übung. Lernplan unverändert. Reguläre Wiederholung ';
  }
  return repeated
    ? 'In dieser Sitzung gefestigt. Nächste Wiederholung '
    : 'Nächste Wiederholung ';
};

const ScheduleNote = ({
  result,
  repeated,
}: {
  readonly result: Extract<
    SubmitResult,
    { readonly graded: true; readonly stored: true }
  >;
  readonly repeated: boolean;
}) => (
  <aside className="border-foreground/30 border-l bg-card/50 p-3">
    <p className="text-muted-foreground text-xs uppercase tracking-wide">
      So geht es weiter
    </p>
    <p className="text-sm">
      {result.schedule.dueAt === null ? (
        'Noch kein weiterer Termin.'
      ) : (
        <>
          {scheduleLead(result, repeated)}
          <time dateTime={result.schedule.dueAt.toISOString()}>
            {formatLearningDate(result.schedule.dueAt).toLocaleLowerCase(
              'de-DE',
            )}
          </time>
          .
        </>
      )}
    </p>
  </aside>
);

export const FeedbackPanel = ({
  result,
  submittedAnswer,
  audioUrl,
  onNext,
  onResolveWrong,
  repeated,
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
        <p className="font-medium">{feedbackHeading(result, repeated)}</p>
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
        {result.graded && result.stored ? (
          <ScheduleNote repeated={repeated} result={result} />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {audioUrl === null ? null : (
          <button
            className="min-h-11 border border-input px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
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
            className="min-h-11 border border-input px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
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
          aria-describedby={feedbackDescriptionId}
          className="min-h-11 bg-primary px-4 py-2 text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
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
