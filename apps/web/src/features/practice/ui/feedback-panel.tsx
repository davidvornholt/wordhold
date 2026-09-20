import type { LanguageCode } from '@wordhold/db/schema/courses';
import { formatLearningDateInline } from '../../../shared/dates/learning-date';
import type { PreparedExampleSentence } from '../../../shared/examples/example-model';
import { normalizeAnswerForComparison } from '../../../shared/grading/normalize';
import type { CardTone } from '../../../shared/ui/word-card';
import type { SubmitResult } from '../schemas/practice-models';
import { feedbackTone } from './feedback-tone';
import { PracticeFeedbackExample } from './practice-feedback-example';

const toneText: Record<CardTone, string> = {
  neutral: 'text-foreground',
  positive: 'text-primary',
  destructive: 'text-destructive',
  warning: 'text-warning-foreground',
};

const toneDivider: Record<CardTone, string> = {
  neutral: 'border-border',
  positive: 'border-primary',
  destructive: 'border-destructive',
  warning: 'border-warning-foreground',
};

type FeedbackPanelProps = {
  readonly busy: boolean;
  // Links the "Weiter" action to this panel as its description.
  readonly id: string;
  readonly result: SubmitResult;
  readonly submittedAnswer: string;
  readonly example: PreparedExampleSentence | null;
  readonly playSentence: (() => Promise<void>) | null;
  readonly playWord: (() => Promise<void>) | null;
  readonly repeated: boolean;
  readonly skipped: boolean;
  readonly targetLanguage: LanguageCode;
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
  <p className="text-muted-foreground text-sm">
    {result.schedule.dueAt === null ? (
      'Noch kein weiterer Termin.'
    ) : (
      <>
        {scheduleLead(result, repeated)}
        <time dateTime={result.schedule.dueAt.toISOString()}>
          {formatLearningDateInline(result.schedule.dueAt)}
        </time>
        .
      </>
    )}
  </p>
);

// The back of the card: what the answer was, why, and what follows. Rendered
// inside the card under the prompt once an answer has been judged.
export const FeedbackPanel = ({
  busy,
  id,
  result,
  submittedAnswer,
  example,
  playSentence,
  playWord,
  repeated,
  skipped,
  targetLanguage,
}: FeedbackPanelProps) => {
  const normalizedSubmission = normalizeAnswerForComparison(submittedAnswer);
  const repeatsSubmittedAnswer = result.expectedAnswers.some(
    (expectedAnswer) =>
      normalizeAnswerForComparison(expectedAnswer) === normalizedSubmission,
  );
  const tone = feedbackTone(result);
  const pendingWrong = result.graded && !result.stored;

  return (
    <div
      aria-busy={busy}
      aria-live="polite"
      className={`flex animate-rise flex-col gap-3 border-t pt-5 ${toneDivider[tone]}`}
      id={id}
      role="status"
    >
      <p className={`font-medium ${toneText[tone]}`}>
        {feedbackHeading(result, repeated, skipped)}
      </p>
      {repeatsSubmittedAnswer ? null : (
        <p>
          <span className="text-muted-foreground text-sm">Erwartet: </span>
          <span className="font-display text-2xl">
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
      {result.graded && example !== null ? (
        <PracticeFeedbackExample
          example={example}
          playSentence={playSentence}
          playWord={playWord}
          targetLanguage={targetLanguage}
        />
      ) : null}
      {result.graded && result.stored ? (
        <ScheduleNote repeated={repeated} result={result} />
      ) : null}
      {pendingWrong ? (
        <p className="text-muted-foreground text-sm">
          Vertippt? „Als richtig werten“ zählt die Karte als schwer und
          speichert deine Antwort nicht als Lösung.
        </p>
      ) : null}
    </div>
  );
};
