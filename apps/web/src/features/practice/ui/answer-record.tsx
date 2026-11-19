import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import type { SoundControl } from '../../../shared/audio/use-pronunciation-audio';
import { normalizeAnswerForComparison } from '../../../shared/grading/normalize';
import { SoundButton } from '../../../shared/ui/sound-button';
import type { FeedbackResult } from '../schemas/practice-models';

type AnswerRecordProps = {
  readonly answerLanguage: LanguageCode;
  readonly kind: CourseKind;
  readonly result: FeedbackResult;
  readonly submittedAnswer: string;
  // The word's pronunciation, played from beside the book's answer.
  readonly word: SoundControl | null;
};

// The line the answer was written on keeps the field's type and spacing, so
// a word stays where it was written when the field gives way to the record.
const lineClass =
  'flex min-h-12 items-center gap-3 border-input border-b-2 pt-1 pb-1.5';
const wordClass =
  'wrap-break-word hyphens-auto min-w-0 font-display text-2xl leading-snug';
// A definition or text keeps the lined page it was written on.
const pageClass =
  'ruled-lines wrap-break-word whitespace-pre-line text-lg leading-8';
// What follows the answer comes in just after the stroke that judged it.
const afterStroke = 'animate-ink [animation-delay:var(--motion-base)]';

// A teacher's tick, drawn once beside a right answer.
const Tick = () => (
  <svg
    aria-hidden="true"
    className="size-7 shrink-0 text-primary"
    fill="none"
    viewBox="0 0 28 28"
  >
    <path
      className="animate-draw [stroke-dasharray:1]"
      d="M4.5 15.5c2.4 1.3 4.3 3.4 5.8 6.5C13.6 13.8 18 8.3 24 4.5"
      pathLength="1"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
    />
  </svg>
);

const WordSound = ({ word }: { readonly word: SoundControl | null }) =>
  word === null ? null : (
    <span className="ml-auto flex shrink-0">
      <SoundButton label="Wort anhören" sound={word} />
    </span>
  );

// The book's answer under the learner's, with a label, where the learner's
// was not judged wrong: "Im Buch" beside a right answer, "Erwartet" beside
// one that could not be checked.
const LabelledAnswer = ({
  answerLanguage,
  kind,
  label,
  text,
  word,
}: {
  readonly answerLanguage: LanguageCode;
  readonly kind: CourseKind;
  readonly label: string;
  readonly text: string;
  readonly word: SoundControl | null;
}) =>
  kind === 'language' ? (
    <p className={`flex items-center gap-2 ${afterStroke}`}>
      <span className="shrink-0 text-muted-foreground text-sm">{`${label}: `}</span>
      <span
        className="wrap-break-word min-w-0 hyphens-auto font-display text-xl"
        lang={answerLanguage}
      >
        {text}
      </span>
      <WordSound word={word} />
    </p>
  ) : (
    <div className={`grid gap-1 ${afterStroke}`}>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p
        className="wrap-break-word hyphens-auto whitespace-pre-line text-lg"
        lang={answerLanguage}
      >
        {text}
      </p>
    </div>
  );

// The learner's answer as written: a word on its line, a definition or text
// on its page.
const Attempt = ({
  answerLanguage,
  children,
  kind,
  text,
  tone,
}: {
  readonly answerLanguage: LanguageCode;
  readonly children?: ReactNode;
  readonly kind: CourseKind;
  readonly text: string;
  // A wrong word is struck through; a wrong definition is only dimmed,
  // since most of it is usually right.
  readonly tone: 'plain' | 'struck';
}) => {
  if (kind !== 'language') {
    return (
      <p
        className={`${pageClass} ${tone === 'struck' ? 'text-muted-foreground' : ''}`}
        lang={answerLanguage}
      >
        <span className="sr-only">Deine Antwort: </span>
        {text}
      </p>
    );
  }
  return (
    <p className={lineClass}>
      <span className="sr-only">Deine Antwort: </span>
      {tone === 'struck' ? (
        <s
          className={`${wordClass} struck text-muted-foreground no-underline`}
          lang={answerLanguage}
        >
          {text}
        </s>
      ) : (
        <span className={wordClass} lang={answerLanguage}>
          {text}
        </span>
      )}
      {children}
    </p>
  );
};

// "Erwartet" beside "Richtig" would read as a correction, so a right word
// names the book's instead. Every word lives in a book, whether a textbook
// or a novel, so "Im Buch" fits both.
const bookLabel = (kind: CourseKind, correct: boolean): string => {
  if (kind === 'terms') {
    return 'Definition';
  }
  if (kind === 'texts') {
    return 'Text';
  }
  return correct ? 'Im Buch' : 'Erwartet';
};

// The book's answer where the learner's was wrong or missing. A missed word
// takes the line itself; under a struck one it is written beneath.
const Correction = ({
  answerLanguage,
  kind,
  onLine,
  text,
  word,
}: {
  readonly answerLanguage: LanguageCode;
  readonly kind: CourseKind;
  readonly onLine: boolean;
  readonly text: string;
  readonly word: SoundControl | null;
}) => {
  if (kind !== 'language') {
    return (
      <LabelledAnswer
        answerLanguage={answerLanguage}
        kind={kind}
        label={bookLabel(kind, false)}
        text={text}
        word={null}
      />
    );
  }
  return (
    <p className={onLine ? lineClass : 'flex items-center gap-3'}>
      <span className="sr-only">Erwartet: </span>
      <span className={`${wordClass} ${afterStroke}`} lang={answerLanguage}>
        {text}
      </span>
      <WordSound word={word} />
    </p>
  );
};

// The answer once judged, where the field was: a right one ticked, a wrong
// one struck through with the book's answer beneath, a missed one replaced
// by the book's. The book's answer is left out where the learner's repeats
// it; an accepted alternative still shows the one the entry intends.
export const AnswerRecord = ({
  answerLanguage,
  kind,
  result,
  submittedAnswer,
  word,
}: AnswerRecordProps) => {
  const expected = result.expectedAnswer;
  const repeats =
    normalizeAnswerForComparison(expected) ===
    normalizeAnswerForComparison(submittedAnswer);
  const attempted = submittedAnswer.trim() !== '';
  if (result.graded && !result.correct) {
    return (
      <>
        {attempted && !repeats ? (
          <Attempt
            answerLanguage={answerLanguage}
            kind={kind}
            text={submittedAnswer}
            tone="struck"
          />
        ) : null}
        <Correction
          answerLanguage={answerLanguage}
          kind={kind}
          onLine={!attempted || repeats}
          text={expected}
          word={word}
        />
      </>
    );
  }
  const correct = result.graded;
  return (
    <>
      <Attempt
        answerLanguage={answerLanguage}
        kind={kind}
        text={submittedAnswer}
        tone="plain"
      >
        {correct ? <Tick /> : null}
        {repeats ? <WordSound word={word} /> : null}
      </Attempt>
      {repeats ? null : (
        <LabelledAnswer
          answerLanguage={answerLanguage}
          kind={kind}
          label={bookLabel(kind, correct)}
          text={expected}
          word={word}
        />
      )}
    </>
  );
};
