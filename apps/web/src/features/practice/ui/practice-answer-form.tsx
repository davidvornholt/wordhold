import type { RefObject, SubmitEventHandler } from 'react';
import { Button } from '../../../shared/ui/button';
import { fieldClass } from '../../../shared/ui/field-styles';

type PracticeAnswerFormProps = {
  readonly answer: string;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly onAnswerChange: (answer: string) => void;
  readonly onSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly promptId: string;
  readonly submittedAnswer: string | null;
};

export const PracticeAnswerForm = ({
  answer,
  busy,
  disabled,
  inputRef,
  onAnswerChange,
  onSubmit,
  promptId,
  submittedAnswer,
}: PracticeAnswerFormProps) => (
  <form aria-busy={busy} className="flex flex-col gap-3" onSubmit={onSubmit}>
    <input
      aria-describedby={promptId}
      aria-label="Deine Antwort"
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      className={fieldClass}
      disabled={busy || disabled}
      onChange={(event) => onAnswerChange(event.target.value)}
      placeholder="Deine Antwort"
      ref={inputRef}
      value={submittedAnswer ?? answer}
    />
    {disabled ? null : (
      <Button disabled={busy || answer.trim() === ''} type="submit">
        {busy ? 'Wird geprüft …' : 'Prüfen'}
      </Button>
    )}
  </form>
);
