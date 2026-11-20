import type { SpellingPitfall } from '@wordhold/ai/pitfalls/schema';
import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import type { SoundControl } from '../../../shared/audio/use-pronunciation-audio';
import {
  formatLearningDate,
  formatReturn,
} from '../../../shared/dates/learning-date';
import { useOwnerTimeZone } from '../../../shared/dates/owner-time-zone';
import type { PreparedExampleSentence } from '../../../shared/examples/example-model';
import {
  compareRecitation,
  type Recitation,
} from '../../../shared/grading/recitation';
import { ExampleSentence } from '../../../shared/ui/example-sentence';
import { KeyPointList } from '../../../shared/ui/key-point-list';
import { SpellingPitfallNote } from '../../../shared/ui/spelling-pitfall-note';
import { Unfold } from '../../../shared/ui/unfold';
import type { FeedbackResult } from '../schemas/practice-models';
import { AnswerRecord, MissedWord, MissedWordSummary } from './answer-record';
import { feedbackTone, toneText } from './feedback-tone';
import { RecitationFeedback } from './recitation-feedback';

type StoredResult = Extract<
  FeedbackResult,
  { readonly graded: true; readonly stored: true }
>;

type FeedbackPanelProps = {
  readonly busy: boolean;
  // Links the "Weiter" action to the verdict as its description.
  readonly id: string;
  readonly result: FeedbackResult;
  readonly submittedAnswer: string;
  // Whether speech recognition wrote the answer.
  readonly dictated: boolean;
  readonly example: PreparedExampleSentence | null;
  readonly sentence: SoundControl | null;
  readonly word: SoundControl | null;
  readonly repeated: boolean;
  readonly skipped: boolean;
  // Where the word is most often misspelled, for a word written in the
  // course's language. Shown beside the answer whatever the outcome, since a
  // word spelled right once can still be misspelled in a test.
  readonly spellingPitfalls: ReadonlyArray<SpellingPitfall> | null;
  readonly targetLanguage: LanguageCode;
  // The language of the expected answer, for hyphenation and speech.
  readonly answerLanguage: LanguageCode;
  readonly kind: CourseKind;
  // The field a missed answer is written out on, or null.
  readonly retype: ReactNode;
};

// A recited text with a few mistakes still counts, but not as right.
const feedbackHeading = (
  result: FeedbackResult,
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

// When the card comes back, as a distance: "kommt morgen wieder". The exact
// time is the title. An early answer to a card not yet due leaves its plan
// as it was, which the note says, so the extra round does not look wasted.
const ReturnNote = ({
  result,
  timeZone,
}: {
  readonly result: StoredResult;
  readonly timeZone: string;
}) => {
  const { advanced, dueAt } = result.schedule;
  if (dueAt === null) {
    return (
      <span className="text-muted-foreground"> · kein weiterer Termin</span>
    );
  }
  return (
    <span className="text-muted-foreground">
      {result.correct && !advanced
        ? ' · Zusätzliche Übung, kommt wie geplant '
        : ' · kommt '}
      <time
        dateTime={dueAt.toISOString()}
        title={formatLearningDate(dueAt, timeZone)}
      >
        {formatReturn(dueAt, timeZone)}
      </time>{' '}
      wieder
    </span>
  );
};

// What the judge found: the key points of a definition, its explanation, and
// whether the answer now counts as an alternative. An answer in other words
// than the book's comes without an explanation, which would read as a
// rejection.
const JudgeNotes = ({
  result,
}: {
  readonly result: Extract<FeedbackResult, { readonly graded: true }>;
}) => (
  <>
    {result.keyPoints === null ? null : (
      <KeyPointList items={result.keyPoints} titled={false} />
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

// The word in use, once it is ready. It unfolds into the card, so the card
// grows rather than jumping when a sentence prepared late arrives.
const FeedbackExample = ({
  busy,
  example,
  kind,
  sentence,
  targetLanguage,
}: Pick<
  FeedbackPanelProps,
  'busy' | 'example' | 'kind' | 'sentence' | 'targetLanguage'
>) => {
  if (example !== null) {
    return (
      <Unfold>
        <ExampleSentence
          example={example}
          sentence={sentence}
          targetLanguage={targetLanguage}
        />
      </Unfold>
    );
  }
  return kind === 'language' && busy ? (
    <p className="text-muted-foreground text-sm">
      Beispielsatz wird vorbereitet …
    </p>
  ) : null;
};

// The back of the card, written where the field was once the answer is
// judged: the answer itself, the verdict and when the card returns, and
// where the word is easy to misspell, all of which "Weiter" reads out as its
// description; then the word in use. A recited text shows the original with
// every mistake marked in place.
//
// A missed answer is written out before the card moves on. A word is written
// right under the struck attempt, where the eye already is, so the verdict
// follows it. A definition or text is copied after the verdict, whose key
// points or marked mistakes say what to look out for while copying.
export const FeedbackPanel = ({
  busy,
  id,
  result,
  submittedAnswer,
  dictated,
  example,
  sentence,
  word,
  repeated,
  skipped,
  spellingPitfalls,
  targetLanguage,
  answerLanguage,
  kind,
  retype,
}: FeedbackPanelProps) => {
  const recitation =
    kind === 'texts' && result.graded && !skipped
      ? compareRecitation(result.expectedAnswer, submittedAnswer, { dictated })
      : null;
  const timeZone = useOwnerTimeZone();
  const missedWord = kind === 'language' && retype !== null;

  return (
    <div className="flex flex-col gap-6">
      {missedWord ? (
        <MissedWord
          answerLanguage={answerLanguage}
          expected={result.expectedAnswer}
          retype={retype}
          submittedAnswer={submittedAnswer}
          word={word}
        />
      ) : null}
      <div
        aria-busy={busy}
        aria-live="polite"
        className="flex flex-col gap-3"
        id={id}
        role="status"
      >
        {missedWord ? (
          <MissedWordSummary
            answerLanguage={answerLanguage}
            expected={result.expectedAnswer}
            submittedAnswer={submittedAnswer}
          />
        ) : null}
        {!missedWord && recitation === null ? (
          <AnswerRecord
            answerLanguage={answerLanguage}
            kind={kind}
            result={result}
            submittedAnswer={submittedAnswer}
            word={word}
          />
        ) : null}
        {recitation === null ? null : (
          <RecitationFeedback
            original={result.expectedAnswer}
            recitation={recitation}
          />
        )}
        <p className="animate-ink text-sm [animation-delay:var(--motion-slow)]">
          <span className={`font-medium ${toneText[feedbackTone(result)]}`}>
            {feedbackHeading(result, recitation, repeated, skipped)}
          </span>
          {result.graded && result.stored ? (
            <ReturnNote result={result} timeZone={timeZone} />
          ) : null}
        </p>
        {result.graded ? <JudgeNotes result={result} /> : null}
        <SpellingPitfallNote
          language={answerLanguage}
          pitfalls={spellingPitfalls}
        />
      </div>
      {missedWord || retype === null ? null : <Unfold>{retype}</Unfold>}
      {result.graded ? (
        <FeedbackExample
          busy={busy}
          example={example}
          kind={kind}
          sentence={sentence}
          targetLanguage={targetLanguage}
        />
      ) : null}
    </div>
  );
};
