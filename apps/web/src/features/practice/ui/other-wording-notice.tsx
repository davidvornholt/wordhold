import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { CourseEntryPlace } from '../schemas/practice-models';

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
// wrong here, so it takes no verdict's color, and it never names the book's
// word, which the next try still asks for. When the answer is another word
// of the course, the notice says where the book teaches it.
export const OtherWordingNotice = ({
  attempt,
  answerLanguage,
}: OtherWordingNoticeProps) => {
  const { answer, courseEntry } = attempt;
  return (
    <div
      aria-live="polite"
      className="flex animate-ink flex-col gap-1 text-sm"
      role="status"
    >
      <p className="font-medium">
        {courseEntry === null
          ? 'Auch richtig, aber hier ist ein anderes Wort aus dem Buch gesucht.'
          : 'Auch richtig, aber hier ist ein anderes Wort gesucht.'}
      </p>
      {courseEntry === null ? null : (
        <p className="wrap-break-word">
          ‚<span lang={answerLanguage}>{courseEntry.text}</span>‘ steht in{' '}
          {endSentence(courseEntry.place)}
        </p>
      )}
      <p className="wrap-break-word text-muted-foreground">
        Deine Antwort: <span lang={answerLanguage}>{answer}</span>
      </p>
    </div>
  );
};
