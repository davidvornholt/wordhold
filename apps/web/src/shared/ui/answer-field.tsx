import type { RefObject } from 'react';
import type { CharacterSet } from '../practice/answer-characters';
import { CharacterPalette } from './character-palette';
import { answerLineClass, answerPageClass } from './field-styles';
import { submitOnEnter } from './submit-on-enter';

export type AnswerFieldElement = HTMLInputElement | HTMLTextAreaElement;

type AnswerFieldProps = {
  // A definition is a sentence or two, so it gets room to wrap. Enter still
  // submits, as in the one-line field; Shift+Enter starts a new line.
  readonly multiline: boolean;
  readonly fieldRef: RefObject<AnswerFieldElement | null>;
  // Characters the keyboard lacks, offered from the field's end; null where
  // the keyboard has them all or the field takes no more input.
  readonly characters: CharacterSet | null;
  readonly id?: string;
  readonly 'aria-describedby'?: string;
  readonly 'aria-label'?: string;
  readonly disabled: boolean;
  readonly lang?: string;
  // The last copy did not match, so the line takes the warning color.
  readonly missed?: boolean;
  // The answer is being checked: a mark runs along the line meanwhile.
  readonly pending?: boolean;
  readonly placeholder: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
};

const lineColor = (missed: boolean, multiline: boolean): string => {
  if (multiline) {
    return missed
      ? '[--rule:var(--warning-foreground)]'
      : 'focus-visible:[--rule:var(--ring)]';
  }
  return missed
    ? 'border-warning-foreground'
    : 'border-input focus-visible:border-ring';
};

// The one field a practice or learning card answers in: the line on the
// card the answer is written on. The wrapper stays when the palette goes, so
// the field keeps its focus.
export const AnswerField = ({
  multiline,
  fieldRef,
  characters,
  missed = false,
  pending = false,
  onChange,
  ...field
}: AnswerFieldProps) => {
  // Room for the palette's toggle, so text never runs beneath it.
  const toggleRoom = characters === null ? '' : ' pr-13';
  // The answer has to come from memory: neither the browser nor the keyboard
  // may correct it, suggest words, or mark a misspelling before it is sent.
  const shared = {
    ...field,
    autoCapitalize: 'off',
    autoComplete: 'off',
    autoCorrect: 'off',
    spellCheck: false,
    className: `${multiline ? answerPageClass : answerLineClass} ${lineColor(missed, multiline)}${toggleRoom} col-start-1 row-start-1`,
  };
  const attach = (node: AnswerFieldElement | null) => {
    fieldRef.current = node;
  };
  return (
    <div className="grid gap-3">
      {multiline ? (
        <textarea
          {...shared}
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
      )}
      {pending ? (
        <span
          aria-hidden="true"
          className="pointer-events-none col-start-1 row-start-1 h-0.5 self-end overflow-hidden motion-reduce:hidden"
        >
          <span className="block h-full w-1/3 animate-scan bg-primary" />
        </span>
      ) : null}
      {characters === null ? null : (
        <CharacterPalette
          characters={characters}
          disabled={field.disabled}
          fieldRef={fieldRef}
          multiline={multiline}
        />
      )}
    </div>
  );
};
