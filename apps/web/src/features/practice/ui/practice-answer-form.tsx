import type { RefObject, SubmitEventHandler } from 'react';
import { Button } from '../../../shared/ui/button';
import { fieldClass } from '../../../shared/ui/field-styles';

type PracticeAnswerFormProps = {
  readonly answer: string;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly onAnswerChange: (answer: string) => void;
  readonly onSkip: () => void;
  readonly onSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly promptId: string;
  readonly skipping: boolean;
  readonly submittedAnswer: string | null;
};

export const PracticeAnswerForm = ({
  answer,
  busy,
  disabled,
  inputRef,
  onAnswerChange,
  onSkip,
  onSubmit,
  promptId,
  skipping,
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
