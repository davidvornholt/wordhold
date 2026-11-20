import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';
import type { RefObject } from 'react';
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
// out from the expected answer, its template.
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
  // Whether the definition or text to copy stands above the field. A recited
  // text is already on the card with its mistakes marked.
  readonly showSource: boolean;
};

const sourceLabels = {
  terms: 'Definition',
  texts: 'Text',
} as const;

// The field a missed answer is written out on before the card moves on. A
// word stands in the field until typing starts, as in the learning pass, so
// it is written from memory, if only for a moment; a definition or text is
// too long to hold, so it is copied from above the field.
export const RetypeLine = ({
  busy,
  characters,
  hintId,
  inputRef,
  kind,
  promptId,
  retype,
  showSource,
}: RetypeLineProps) => {
  const missed = retype.missedMessage !== null;
  return (
    <div className="flex flex-col gap-2">
      {isListCourse(kind) && showSource ? (
        <div className="mb-1 flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">{sourceLabels[kind]}</p>
          <p
            className="wrap-break-word hyphens-auto whitespace-pre-line text-lg leading-8"
            id={hintId}
            lang={retype.templateLanguage}
          >
            {retype.template}
          </p>
        </div>
      ) : (
        <span className="sr-only" id={hintId}>
          Vorlage: <span lang={retype.templateLanguage}>{retype.template}</span>
        </span>
      )}
      <AnswerField
        aria-describedby={`${promptId} ${hintId}`}
        aria-label="Schreib die Antwort ab"
        characters={characters}
        disabled={busy}
        fieldRef={inputRef}
        missed={missed}
        multiline={isListCourse(kind)}
        onChange={retype.onTypedChange}
        placeholder={isListCourse(kind) ? 'Hier abschreiben' : retype.template}
        value={retype.typed}
      />
      {missed ? (
        <p className="text-sm text-warning-foreground" role="status">
          {retype.missedMessage}
        </p>
      ) : null}
    </div>
  );
};
