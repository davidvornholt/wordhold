import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { CourseEntryPlace } from '../schemas/practice-models';
import { toneDivider, toneText } from './feedback-tone';

// The last answer in other words than the book's, kept while the card stays
// open for another try.
export type OtherWordingAttempt = {
  readonly answer: string;
  readonly courseEntry: CourseEntryPlace | null;
  // Counts these answers on the card, so each one is shown afresh.
  readonly attempt: number;
};

// A unit name may already end a sentence, as '¡Acércate!' does.
const sentenceEnd = /[.!?…]$/u;

const endSentence = (text: string): string =>
  sentenceEnd.test(text) ? text : `${text}.`;

type OtherWordingNoticeProps = {
  readonly attempt: OtherWordingAttempt;
  readonly answerLanguage: LanguageCode;
};

// A correct translation that is not the book's word. It is neither right nor
// wrong here, so it takes the card's neutral tone, and it never names the
// book's word, which the next try still asks for. When the answer is another
// word of the course, the notice says where the book teaches it.
export const OtherWordingNotice = ({
  attempt,
  answerLanguage,
}: OtherWordingNoticeProps) => {
  const { answer, courseEntry } = attempt;
  return (
    <div
      aria-live="polite"
      className={`flex animate-rise flex-col gap-3 border-t pt-5 ${toneDivider.neutral}`}
      role="status"
    >
      <p className={`font-medium ${toneText.neutral}`}>
        {courseEntry === null
          ? 'Auch richtig, aber hier ist ein anderes Wort aus dem Buch gesucht.'
          : 'Auch richtig, aber hier ist ein anderes Wort gesucht.'}
      </p>
      {courseEntry === null ? null : (
        <p className="wrap-break-word text-sm">
          ‚<span lang={answerLanguage}>{courseEntry.text}</span>‘ steht in{' '}
          {endSentence(courseEntry.place)}
        </p>
      )}
      <p className="wrap-break-word text-muted-foreground text-sm">
        Deine Antwort: <span lang={answerLanguage}>{answer}</span>
      </p>
    </div>
  );
};
