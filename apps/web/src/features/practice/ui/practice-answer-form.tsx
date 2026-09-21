import type { RefObject, SubmitEventHandler } from 'react';
import { Button } from '../../../shared/ui/button';
import { answerFieldClass } from '../../../shared/ui/field-styles';
import type { CardTone } from '../../../shared/ui/word-card';

const toneField: Record<CardTone, string> = {
  neutral: 'border-input',
  positive: 'border-primary',
  destructive: 'border-destructive',
  warning: 'border-warning-foreground',
};

// After a wrong or skipped answer the field asks for the answer to be written
// out; the expected answer is its template until the learner types.
export type RetypeState = {
  readonly template: string;
  readonly templateLanguage: string;
  readonly typed: string;
  readonly missed: boolean;
  readonly onTypedChange: (typed: string) => void;
};

type PracticeAnswerFormProps = {
  readonly answer: string;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly inputRef: RefObject<HTMLInputElement | null>;
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
  promptId,
  retype,
}: Pick<PracticeAnswerFormProps, 'busy' | 'inputRef' | 'promptId'> & {
  readonly hintId: string;
  readonly retype: RetypeState;
}) => (
  <>
    {retype.typed === '' ? (
      <span className="sr-only" id={hintId}>
        Vorlage: <span lang={retype.templateLanguage}>{retype.template}</span>
      </span>
    ) : null}
    <input
      aria-describedby={
        retype.typed === '' ? `${promptId} ${hintId}` : promptId
      }
      aria-label="Schreib die Antwort ab"
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      className={`${answerFieldClass} ${
        retype.missed ? toneField.warning : toneField.neutral
      }`}
      disabled={busy}
      onChange={(event) => retype.onTypedChange(event.target.value)}
      placeholder={retype.template}
      ref={inputRef}
      value={retype.typed}
    />
    {retype.missed ? (
      <p className="text-center text-sm" role="status">
        Noch nicht ganz. Schreib die Vokabel genau so ab.
      </p>
    ) : null}
  </>
);

export const PracticeAnswerForm = ({
  answer,
  busy,
  disabled,
  inputRef,
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
      <input
        aria-describedby={promptId}
        aria-label="Deine Antwort"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className={`${answerFieldClass} ${toneField[tone]}`}
        disabled={busy || disabled}
        onChange={(event) => onAnswerChange(event.target.value)}
        placeholder="Deine Antwort"
        ref={inputRef}
        value={submittedAnswer ?? answer}
      />
    ) : (
      <RetypeField
        busy={busy}
        hintId={`${promptId}-retype-hint`}
        inputRef={inputRef}
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
