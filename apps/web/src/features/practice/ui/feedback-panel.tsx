import { useEffect, useId, useRef } from 'react';
import { formatLearningDate } from '../../../shared/dates/learning-date';
import { normalizeAnswer } from '../../../shared/grading/normalize';
import { Button } from '../../../shared/ui/button';
import { Callout } from '../../../shared/ui/callout';
import type { SubmitResult } from '../schemas/practice-models';
import type { WrongAnswerResolution } from '../schemas/submission-schema';

const panelTone = (result: SubmitResult) => {
  if (!result.graded) {
    return 'warning' as const;
  }
  return result.correct ? ('positive' as const) : ('destructive' as const);
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
  readonly skipped: boolean;
};

const feedbackHeading = (
  result: SubmitResult,
  repeated: boolean,
  skipped: boolean,
): string => {
  if (!result.graded) {
    return result.message;
  }
  if (!result.correct) {
    return skipped ? 'Nicht gewusst' : 'Noch nicht sicher';
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
  <Callout tone="neutral">
    <p className="eyebrow">So geht es weiter</p>
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
  </Callout>
);

export const FeedbackPanel = ({
  result,
  submittedAnswer,
  audioUrl,
  onNext,
  onResolveWrong,
  repeated,
  resolution,
  skipped,
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
    <Callout aria-busy={resolution !== null} tone={panelTone(result)}>
      <div
        aria-live="polite"
        className="flex flex-col gap-3"
        id={feedbackDescriptionId}
        role="status"
      >
        <p className="font-medium">
          {feedbackHeading(result, repeated, skipped)}
        </p>
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
          <Button
            onClick={async () => {
              await new Audio(audioUrl).play().catch(() => undefined);
            }}
            variant="outline"
          >
            Aussprache anhören
          </Button>
        )}
        {pendingWrong ? (
          <Button
            disabled={resolution !== null}
            onClick={() => onResolveWrong('hard')}
            variant="outline"
          >
            {resolution === 'hard'
              ? 'Wird gespeichert …'
              : 'Als richtig werten'}
          </Button>
        ) : null}
        <Button
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
        >
          {resolution === 'again' ? 'Wird gespeichert …' : 'Weiter'}
        </Button>
      </div>
    </Callout>
  );
};
