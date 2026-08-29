import type { RefObject, SubmitEventHandler } from 'react';

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
      className="min-h-11 border border-input bg-card px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
      disabled={busy || disabled}
      onChange={(event) => onAnswerChange(event.target.value)}
      placeholder="Deine Antwort"
      ref={inputRef}
      value={submittedAnswer ?? answer}
    />
    {disabled ? null : (
      <button
        className="min-h-11 bg-primary px-4 py-2 text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
        disabled={busy || answer.trim() === ''}
        type="submit"
      >
        {busy ? 'Wird geprüft …' : 'Prüfen'}
      </button>
    )}
  </form>
);
