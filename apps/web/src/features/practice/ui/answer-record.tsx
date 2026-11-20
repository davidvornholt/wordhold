import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import type { SoundControl } from '../../../shared/audio/use-pronunciation-audio';
import { normalizeAnswerForComparison } from '../../../shared/grading/normalize';
import {
  answerLineType,
  answerPageType,
} from '../../../shared/ui/field-styles';
import { SoundButton } from '../../../shared/ui/sound-button';
import { VerdictMark } from '../../../shared/ui/verdict-mark';
import type { FeedbackResult } from '../schemas/practice-models';

// The answer once judged keeps the field's type and spacing without its
// rule, so the words stay where they were written when the field gives way
// to the record.
const lineClass = `${answerLineType} flex items-center gap-3 border-transparent`;
const wordClass = 'wrap-break-word hyphens-auto min-w-0';
const pageClass = `${answerPageType} wrap-break-word hyphens-auto whitespace-pre-line border-transparent`;
// What follows the answer comes in just after the stroke that judged it.
const afterStroke = 'animate-ink [animation-delay:var(--motion-base)]';

const WordSound = ({ word }: { readonly word: SoundControl | null }) =>
  word === null ? null : (
    <span className="ml-auto flex shrink-0">
      <SoundButton label="Wort anhören" sound={word} />
    </span>
  );

const repeatsBook = (expected: string, submitted: string): boolean =>
  normalizeAnswerForComparison(expected) ===
  normalizeAnswerForComparison(submitted);

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
        className="wrap-break-word hyphens-auto whitespace-pre-line text-lg leading-8"
        lang={answerLanguage}
      >
        {text}
      </p>
    </div>
  );

// The learner's answer as written: a word on its line with whatever stands
// beside it, a definition or text as a paragraph. A wrong definition is only
// dimmed, since most of it is usually right.
const Attempt = ({
  answerLanguage,
  children,
  dimmed,
  kind,
  text,
}: {
  readonly answerLanguage: LanguageCode;
  readonly children?: ReactNode;
  readonly dimmed: boolean;
  readonly kind: CourseKind;
  readonly text: string;
}) =>
  kind === 'language' ? (
    <p className={lineClass}>
      <span className="sr-only">Deine Antwort: </span>
      <span className={wordClass} lang={answerLanguage}>
        {text}
      </span>
      {children}
    </p>
  ) : (
    <p
      className={`${pageClass} ${dimmed ? 'text-muted-foreground' : ''}`}
      lang={answerLanguage}
    >
      <span className="sr-only">Deine Antwort: </span>
      {text}
    </p>
  );

// A judged answer that was not wrong, where the field was: a right one with
// a check, beside the book's answer where the two differ, and one that could
// not be checked beside the answer expected. A wrong definition stays as
// written, dimmed; the definition to copy comes after the verdict. A wrong
// word is shown by MissedWord instead.
export const AnswerRecord = ({
  answerLanguage,
  kind,
  result,
  submittedAnswer,
  word,
}: {
  readonly answerLanguage: LanguageCode;
  readonly kind: CourseKind;
  readonly result: FeedbackResult;
  readonly submittedAnswer: string;
  // The word's pronunciation, played from beside the book's answer.
  readonly word: SoundControl | null;
}) => {
  const expected = result.expectedAnswer;
  if (result.graded && !result.correct) {
    return submittedAnswer.trim() === '' ? null : (
      <Attempt
        answerLanguage={answerLanguage}
        dimmed={true}
        kind={kind}
        text={submittedAnswer}
      />
    );
  }
  const correct = result.graded;
  const repeats = repeatsBook(expected, submittedAnswer);
  return (
    <>
      <Attempt
        answerLanguage={answerLanguage}
        dimmed={false}
        kind={kind}
        text={submittedAnswer}
      >
        {correct ? <VerdictMark className="size-6" kind="check" /> : null}
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

// A wrong or missed word: the attempt struck through where it was written,
// and beneath it the line to write the book's word on, whose faint letters
// show the word itself, so it appears once. Both are drawn for the eye; the
// verdict reads them out as MissedWordSummary.
export const MissedWord = ({
  answerLanguage,
  expected,
  retype,
  submittedAnswer,
  word,
}: {
  readonly answerLanguage: LanguageCode;
  readonly expected: string;
  // The line to write the word on.
  readonly retype: ReactNode;
  readonly submittedAnswer: string;
  readonly word: SoundControl | null;
}) => (
  <div className="flex flex-col">
    {submittedAnswer.trim() === '' ||
    repeatsBook(expected, submittedAnswer) ? null : (
      <p aria-hidden="true" className={lineClass}>
        <s
          className={`${wordClass} struck text-muted-foreground no-underline`}
          lang={answerLanguage}
        >
          {submittedAnswer}
        </s>
      </p>
    )}
    <div className={`flex items-start gap-3 ${afterStroke}`}>
      <div className="min-w-0 flex-1">{retype}</div>
      {word === null ? null : (
        // Level with the line the word is written on.
        <span className="flex h-12 shrink-0 items-center">
          <SoundButton label="Wort anhören" sound={word} />
        </span>
      )}
    </div>
  </div>
);

// What MissedWord shows, in words, at the start of the verdict.
export const MissedWordSummary = ({
  answerLanguage,
  expected,
  submittedAnswer,
}: {
  readonly answerLanguage: LanguageCode;
  readonly expected: string;
  readonly submittedAnswer: string;
}) => (
  <span className="sr-only">
    {submittedAnswer.trim() === '' ? null : (
      <>
        Deine Antwort: <span lang={answerLanguage}>{submittedAnswer}</span>.{' '}
      </>
    )}
    Erwartet: <span lang={answerLanguage}>{expected}</span>.{' '}
  </span>
);
