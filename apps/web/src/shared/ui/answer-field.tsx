import type { KeyboardEvent, RefObject } from 'react';
import { answerFieldClass } from './field-styles';

export type AnswerFieldElement = HTMLInputElement | HTMLTextAreaElement;

type AnswerFieldProps = {
  // A definition is a sentence or two, so it gets room to wrap. Enter still
  // submits, as in the one-line field; Shift+Enter starts a new line.
  readonly multiline: boolean;
  readonly fieldRef: RefObject<AnswerFieldElement | null>;
  readonly id?: string;
  readonly 'aria-describedby'?: string;
  readonly 'aria-label'?: string;
  readonly borderClass: string;
  readonly disabled: boolean;
  readonly lang?: string;
  readonly placeholder: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
};

const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.nativeEvent.isComposing
  ) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
};

// The one field a practice or learning card answers in.
export const AnswerField = ({
  multiline,
  fieldRef,
  borderClass,
  onChange,
  ...field
}: AnswerFieldProps) => {
  const shared = {
    ...field,
    autoCapitalize: 'off',
    autoComplete: 'off',
    autoCorrect: 'off',
    className: `${answerFieldClass} ${borderClass}`,
  };
  const attach = (node: AnswerFieldElement | null) => {
    fieldRef.current = node;
  };
  return multiline ? (
    <textarea
      {...shared}
      className={`${shared.className} field-sizing-content min-h-28 resize-none`}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={submitOnEnter}
      ref={attach}
      rows={3}
    />
  ) : (
    <input
      {...shared}
      onChange={(event) => onChange(event.target.value)}
      ref={attach}
    />
  );
};
