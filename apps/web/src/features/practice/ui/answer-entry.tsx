import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import { type RefObject, useId } from 'react';
import { isListCourse } from '../../../shared/directions';
import type { CharacterSet } from '../../../shared/practice/answer-characters';
import {
  AnswerField,
  type AnswerFieldElement,
} from '../../../shared/ui/answer-field';
import { DictationButton } from './dictation-button';
import {
  type OtherWordingAttempt,
  OtherWordingNotice,
} from './other-wording-notice';
import type { Dictation } from './use-dictation';

// After a wrong or skipped answer the card asks for the answer to be written
// out; the expected answer is the line's template until the learner types.
export type RetypeState = {
  readonly template: string;
  readonly templateLanguage: string;
  readonly typed: string;
  // What went wrong in the last attempt, or null before one was checked.
  readonly missedMessage: string | null;
  readonly onTypedChange: (typed: string) => void;
};

const answerPlaceholders = {
  language: 'Deine Antwort',
  terms: 'Deine Definition',
  texts: 'Dein Text',
} as const satisfies Record<CourseKind, string>;

type AnswerEntryProps = {
  readonly answerLanguage: LanguageCode;
  readonly busy: boolean;
  readonly characters: CharacterSet | null;
  readonly dictation: Dictation;
  readonly inputRef: RefObject<AnswerFieldElement | null>;
  readonly kind: CourseKind;
  readonly onAnswerChange: (answer: string) => void;
  // The last answer in other words than the book's, while the card stays
  // open for another try.
  readonly otherWording: OtherWordingAttempt | null;
  // The answer is being checked, not skipped.
  readonly checking: boolean;
  readonly promptId: string;
  readonly value: string;
};

// The card before it is judged: the line to write the answer on, and for a
// text, the button to recite it instead.
export const AnswerEntry = ({
  answerLanguage,
  busy,
  characters,
  dictation,
  inputRef,
  kind,
  onAnswerChange,
  otherWording,
  checking,
  promptId,
  value,
}: AnswerEntryProps) => (
  <div className="flex flex-col gap-4">
    <AnswerField
      aria-describedby={promptId}
      aria-label="Deine Antwort"
      characters={characters}
      disabled={busy}
      fieldRef={inputRef}
      multiline={isListCourse(kind)}
      onChange={onAnswerChange}
      pending={checking}
      placeholder={answerPlaceholders[kind]}
      value={value}
    />
    {kind === 'texts' && dictation.supported ? (
      <div className="flex flex-col items-start gap-2">
        <DictationButton dictation={dictation} disabled={busy} />
      </div>
    ) : null}
    {otherWording === null ? null : (
      // A new key for each answer replays the notice's entrance.
      <OtherWordingNotice
        answerLanguage={answerLanguage}
        attempt={otherWording}
        key={otherWording.attempt}
      />
    )}
  </div>
);

type RetypeLineProps = {
  readonly busy: boolean;
  readonly characters: CharacterSet | null;
  readonly hintId: string;
  readonly inputRef: RefObject<AnswerFieldElement | null>;
  readonly kind: CourseKind;
  readonly promptId: string;
  readonly retype: RetypeState;
};

// The line a missed answer is written out on before the card moves on. Its
// template is the answer itself, gone as soon as typing starts; the label
// says why the answer appears a second time.
export const RetypeLine = ({
  busy,
  characters,
  hintId,
  inputRef,
  kind,
  promptId,
  retype,
}: RetypeLineProps) => {
  const fieldId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label className="text-muted-foreground text-sm" htmlFor={fieldId}>
        Schreib die Antwort ab
      </label>
      {retype.typed === '' ? (
        <span className="sr-only" id={hintId}>
          Vorlage: <span lang={retype.templateLanguage}>{retype.template}</span>
        </span>
      ) : null}
      <AnswerField
        aria-describedby={
          retype.typed === '' ? `${promptId} ${hintId}` : promptId
        }
        characters={characters}
        disabled={busy}
        fieldRef={inputRef}
        id={fieldId}
        missed={retype.missedMessage !== null}
        multiline={isListCourse(kind)}
        onChange={retype.onTypedChange}
        placeholder={retype.template}
        value={retype.typed}
      />
      {retype.missedMessage === null ? null : (
        <p className="mt-1 text-sm text-warning-foreground" role="status">
          {retype.missedMessage}
        </p>
      )}
    </div>
  );
};
