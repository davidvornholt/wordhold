import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import { formatLearningDateInline } from '../../../shared/dates/learning-date';
import type { PreparedExampleSentence } from '../../../shared/examples/example-model';
import { normalizeAnswerForComparison } from '../../../shared/grading/normalize';
import { KeyPointList } from '../../../shared/ui/key-point-list';
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
  // The language of the expected answer, for hyphenation and speech.
  readonly answerLanguage: LanguageCode;
  readonly kind: CourseKind;
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

// What the judge found: the key points of a definition, its explanation, and
// whether the answer now counts as an alternative.
const JudgeNotes = ({
  result,
}: {
  readonly result: Extract<SubmitResult, { readonly graded: true }>;
}) => (
  <>
    {result.keyPoints === null ? null : (
      <KeyPointList items={result.keyPoints} />
    )}
    {result.explanation === null ? null : (
      <p className="text-sm">{result.explanation}</p>
    )}
    {result.acceptedAsAlternative ? (
      <p className="text-accent-foreground text-sm">
        Deine Antwort wurde als gültige Alternative gespeichert.
      </p>
    ) : null}
  </>
);

const ExpectedAnswer = ({
  answerLanguage,
  definition,
  expectedAnswers,
}: {
  readonly answerLanguage: LanguageCode;
  readonly definition: boolean;
  readonly expectedAnswers: ReadonlyArray<string>;
}) => (
  <p>
    <span className="text-muted-foreground text-sm">
      {definition ? 'Definition: ' : 'Erwartet: '}
    </span>
    <span
      className={
        definition
          ? 'wrap-break-word hyphens-auto text-lg'
          : 'wrap-break-word hyphens-auto font-display text-2xl'
      }
      lang={answerLanguage}
    >
      {definition ? expectedAnswers.at(0) : expectedAnswers.join(' / ')}
    </span>
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
  answerLanguage,
  kind,
}: FeedbackPanelProps) => {
  const definition = kind === 'terms';
  const normalizedSubmission = normalizeAnswerForComparison(submittedAnswer);
  const repeatsSubmittedAnswer = result.expectedAnswers.some(
    (expectedAnswer) =>
      normalizeAnswerForComparison(expectedAnswer) === normalizedSubmission,
  );
  const tone = feedbackTone(result);
  const pendingWrong = result.graded && !result.stored;
  // The field below now asks for the answer to be written out, so the
  // attempt is kept here for comparison.
  const showsAttempt =
    result.graded &&
    !result.correct &&
    !repeatsSubmittedAnswer &&
    submittedAnswer.trim() !== '';

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
        <ExpectedAnswer
          answerLanguage={answerLanguage}
          definition={definition}
          expectedAnswers={result.expectedAnswers}
        />
      )}
      {showsAttempt ? (
        <p className="text-muted-foreground text-sm">
          Deine Antwort: <span lang={answerLanguage}>{submittedAnswer}</span>
        </p>
      ) : null}
      {result.graded ? <JudgeNotes result={result} /> : null}
      {result.graded && example !== null ? (
        <PracticeFeedbackExample
          example={example}
          playSentence={playSentence}
          playWord={playWord}
          targetLanguage={targetLanguage}
        />
      ) : null}
      {result.graded && !definition && example === null && busy ? (
        <p className="text-muted-foreground text-sm">
          Beispielsatz wird vorbereitet …
        </p>
      ) : null}
      {result.graded && result.stored ? (
        <ScheduleNote repeated={repeated} result={result} />
      ) : null}
      {pendingWrong ? (
        <p className="text-muted-foreground text-sm">
          {definition
            ? 'Steht doch alles drin? „Als richtig werten“ zählt die Karte als schwer.'
            : 'Vertippt? „Als richtig werten“ zählt die Karte als schwer und speichert deine Antwort nicht als Lösung.'}
        </p>
      ) : null}
    </div>
  );
};
