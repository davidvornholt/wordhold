import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import { formatLearningDateInline } from '../../../shared/dates/learning-date';
import type { PreparedExampleSentence } from '../../../shared/examples/example-model';
import { normalizeAnswerForComparison } from '../../../shared/grading/normalize';
import {
  compareRecitation,
  type Recitation,
} from '../../../shared/grading/recitation';
import { KeyPointList } from '../../../shared/ui/key-point-list';
import type { SubmitResult } from '../schemas/practice-models';
import { feedbackTone, toneDivider, toneText } from './feedback-tone';
import { PracticeFeedbackExample } from './practice-feedback-example';
import { RecitationFeedback } from './recitation-feedback';

type FeedbackPanelProps = {
  readonly busy: boolean;
  // Links the "Weiter" action to this panel as its description.
  readonly id: string;
  readonly result: SubmitResult;
  readonly submittedAnswer: string;
  // Whether speech recognition wrote the answer.
  readonly dictated: boolean;
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

// A recited text with a few mistakes still counts, but not as right.
const feedbackHeading = (
  result: SubmitResult,
  recitation: Recitation | null,
  repeated: boolean,
  skipped: boolean,
): string => {
  if (!result.graded) {
    return result.message;
  }
  if (!result.correct) {
    return skipped ? 'Nicht gewusst' : 'Noch nicht sicher';
  }
  if (recitation !== null && recitation.mistakes > 0) {
    return 'Fast richtig';
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

// "Erwartet" beside "Richtig" would read as a correction, so a correct answer
// names the book's word instead. Every word lives in a book, whether a
// textbook or a novel, so "Im Buch" fits both.
const expectedAnswerLabel = (
  result: SubmitResult,
  kind: CourseKind,
): string => {
  if (kind === 'terms') {
    return 'Definition: ';
  }
  if (kind === 'texts') {
    return 'Text: ';
  }
  return result.graded && result.correct ? 'Im Buch: ' : 'Erwartet: ';
};

const expectedAnswerClass = {
  language: 'wrap-break-word hyphens-auto font-display text-2xl',
  terms: 'wrap-break-word hyphens-auto text-lg',
  texts: 'wrap-break-word hyphens-auto whitespace-pre-line text-lg',
} as const satisfies Record<CourseKind, string>;

const ExpectedAnswer = ({
  answerLanguage,
  kind,
  expectedAnswer,
  label,
}: {
  readonly answerLanguage: LanguageCode;
  readonly kind: CourseKind;
  readonly expectedAnswer: string;
  readonly label: string;
}) => (
  <p>
    <span className="text-muted-foreground text-sm">{label}</span>
    <span className={expectedAnswerClass[kind]} lang={answerLanguage}>
      {expectedAnswer}
    </span>
  </p>
);

// The expected answer, unless the learner's repeats it, and a wrong attempt
// beside it.
const AnswerComparison = ({
  answerLanguage,
  kind,
  result,
  submittedAnswer,
}: Pick<
  FeedbackPanelProps,
  'answerLanguage' | 'kind' | 'result' | 'submittedAnswer'
>) => {
  // Only the textbook answer itself makes it redundant: an accepted
  // alternative still shows the solution the entry intends.
  const repeatsSubmittedAnswer =
    normalizeAnswerForComparison(result.expectedAnswer) ===
    normalizeAnswerForComparison(submittedAnswer);
  // The field below now asks for the answer to be written out, so the
  // attempt is kept here for comparison.
  const showsAttempt =
    result.graded &&
    !result.correct &&
    !repeatsSubmittedAnswer &&
    submittedAnswer.trim() !== '';
  return (
    <>
      {repeatsSubmittedAnswer ? null : (
        <ExpectedAnswer
          answerLanguage={answerLanguage}
          expectedAnswer={result.expectedAnswer}
          kind={kind}
          label={expectedAnswerLabel(result, kind)}
        />
      )}
      {showsAttempt ? (
        <p className="text-muted-foreground text-sm">
          Deine Antwort: <span lang={answerLanguage}>{submittedAnswer}</span>
        </p>
      ) : null}
    </>
  );
};

// The back of the card: what the answer was, why, and what follows. Rendered
// inside the card under the prompt once an answer has been judged. A recited
// text shows the original with every mistake marked in place.
export const FeedbackPanel = ({
  busy,
  id,
  result,
  submittedAnswer,
  dictated,
  example,
  playSentence,
  playWord,
  repeated,
  skipped,
  targetLanguage,
  answerLanguage,
  kind,
}: FeedbackPanelProps) => {
  const recitation =
    kind === 'texts' && result.graded && !skipped
      ? compareRecitation(result.expectedAnswer, submittedAnswer, { dictated })
      : null;
  const tone = feedbackTone(result);
  // A recited text is never held back for overruling, so only a word or a
  // definition gets here.
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
        {feedbackHeading(result, recitation, repeated, skipped)}
      </p>
      {recitation === null ? (
        <AnswerComparison
          answerLanguage={answerLanguage}
          kind={kind}
          result={result}
          submittedAnswer={submittedAnswer}
        />
      ) : (
        <RecitationFeedback
          original={result.expectedAnswer}
          recitation={recitation}
        />
      )}
      {result.graded ? <JudgeNotes result={result} /> : null}
      {result.graded && example !== null ? (
        <PracticeFeedbackExample
          example={example}
          playSentence={playSentence}
          playWord={playWord}
          targetLanguage={targetLanguage}
        />
      ) : null}
      {result.graded && kind === 'language' && example === null && busy ? (
        <p className="text-muted-foreground text-sm">
          Beispielsatz wird vorbereitet …
        </p>
      ) : null}
      {result.graded && result.stored ? (
        <ScheduleNote repeated={repeated} result={result} />
      ) : null}
      {pendingWrong ? (
        <p className="text-muted-foreground text-sm">
          {kind === 'terms'
            ? 'Steht doch alles drin? Dann werte die Antwort als richtig. Die Karte kommt etwas früher wieder als nach einer auf Anhieb richtigen Antwort.'
            : 'Vertippt? Dann werte die Antwort als richtig. Die Karte kommt etwas früher wieder als nach einer auf Anhieb richtigen Antwort, und deine Antwort wird nicht als weitere Lösung gespeichert.'}
        </p>
      ) : null}
    </div>
  );
};
