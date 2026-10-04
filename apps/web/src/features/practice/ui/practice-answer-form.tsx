import type { RefObject, SubmitEventHandler } from 'react';
import {
  AnswerField,
  type AnswerFieldElement,
} from '../../../shared/ui/answer-field';
import { Button } from '../../../shared/ui/button';
import type { CardTone } from '../../../shared/ui/word-card';
import { toneField } from './feedback-tone';

// After a wrong or skipped answer the field asks for the answer to be written
// out; the expected answer is its template until the learner types.
export type RetypeState = {
  readonly template: string;
  readonly templateLanguage: string;
  readonly typed: string;
  // What went wrong in the last attempt, or null before one was checked.
  readonly missedMessage: string | null;
  readonly onTypedChange: (typed: string) => void;
};

type PracticeAnswerFormProps = {
  readonly answer: string;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly inputRef: RefObject<AnswerFieldElement | null>;
  // Definitions are answered in a field that wraps.
  readonly multiline: boolean;
  readonly onAnswerChange: (answer: string) => void;
  readonly onSkip: () => void;
  readonly onSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly promptId: string;
  readonly retype: RetypeState | null;
  readonly skipping: boolean;
  readonly submittedAnswer: string | null;
  // Once judged, the field keeps the answer and takes the verdict's tone.
  readonly tone: CardTone;
};

const RetypeField = ({
  busy,
  hintId,
  inputRef,
  multiline,
  promptId,
  retype,
}: Pick<
  PracticeAnswerFormProps,
  'busy' | 'inputRef' | 'multiline' | 'promptId'
> & {
  readonly hintId: string;
  readonly retype: RetypeState;
}) => (
  <>
    {retype.typed === '' ? (
      <span className="sr-only" id={hintId}>
        Vorlage: <span lang={retype.templateLanguage}>{retype.template}</span>
      </span>
    ) : null}
    <AnswerField
      aria-describedby={
        retype.typed === '' ? `${promptId} ${hintId}` : promptId
      }
      aria-label="Schreib die Antwort ab"
      borderClass={
        retype.missedMessage === null ? toneField.neutral : toneField.warning
      }
      disabled={busy}
      fieldRef={inputRef}
      multiline={multiline}
      onChange={retype.onTypedChange}
      placeholder={retype.template}
      value={retype.typed}
    />
    {retype.missedMessage === null ? null : (
      <p className="text-center text-sm" role="status">
        {retype.missedMessage}
      </p>
    )}
  </>
);

export const PracticeAnswerForm = ({
  answer,
  busy,
  disabled,
  inputRef,
  multiline,
  onAnswerChange,
  onSkip,
  onSubmit,
  promptId,
  retype,
  skipping,
  submittedAnswer,
  tone,
}: PracticeAnswerFormProps) => (
  <form aria-busy={busy} className="flex flex-col gap-3" onSubmit={onSubmit}>
    {retype === null ? (
      <AnswerField
        aria-describedby={promptId}
        aria-label="Deine Antwort"
        borderClass={toneField[tone]}
        disabled={busy || disabled}
        fieldRef={inputRef}
        multiline={multiline}
        onChange={onAnswerChange}
        placeholder={multiline ? 'Deine Definition' : 'Deine Antwort'}
        value={submittedAnswer ?? answer}
      />
    ) : (
      <RetypeField
        busy={busy}
        hintId={`${promptId}-retype-hint`}
        inputRef={inputRef}
        multiline={multiline}
        promptId={promptId}
        retype={retype}
      />
    )}
    {disabled ? null : (
      <>
        <Button disabled={busy || answer.trim() === ''} type="submit">
          {busy && !skipping ? 'Wird geprüft …' : 'Prüfen'}
        </Button>
        <Button
          className="w-fit self-center px-3 py-2"
          disabled={busy}
          onClick={onSkip}
          variant="quiet-muted"
        >
          {skipping ? 'Wird gespeichert …' : 'Weiß ich nicht'}
        </Button>
      </>
    )}
  </form>
);
