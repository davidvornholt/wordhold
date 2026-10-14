import type { RefObject } from 'react';
import type { CharacterSet } from '../practice/answer-characters';
import { CharacterPalette } from './character-palette';
import { answerFieldClass } from './field-styles';
import { submitOnEnter } from './submit-on-enter';

export type AnswerFieldElement = HTMLInputElement | HTMLTextAreaElement;

type AnswerFieldProps = {
  // A definition is a sentence or two, so it gets room to wrap. Enter still
  // submits, as in the one-line field; Shift+Enter starts a new line.
  readonly multiline: boolean;
  readonly fieldRef: RefObject<AnswerFieldElement | null>;
  // Characters the keyboard lacks, offered from the field's corner; null
  // where the keyboard has them all or the field takes no more input.
  readonly characters: CharacterSet | null;
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

// The one field a practice or learning card answers in. The wrapper stays
// when the palette goes, so the field keeps its focus.
export const AnswerField = ({
  multiline,
  fieldRef,
  characters,
  borderClass,
  onChange,
  ...field
}: AnswerFieldProps) => {
  // Room for the palette's toggle, so text never runs beneath it, with the
  // same space before it as the field has on its left.
  const toggleRoom = characters === null ? '' : ' pr-15';
  // The answer has to come from memory: neither the browser nor the keyboard
  // may correct it, suggest words, or mark a misspelling before it is sent.
  const shared = {
    ...field,
    autoCapitalize: 'off',
    autoComplete: 'off',
    autoCorrect: 'off',
    spellCheck: false,
    className: `${answerFieldClass} ${borderClass}${toggleRoom} col-start-1 row-start-1`,
  };
  const attach = (node: AnswerFieldElement | null) => {
    fieldRef.current = node;
  };
  return (
    <div className="grid gap-3">
      {multiline ? (
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
      )}
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
