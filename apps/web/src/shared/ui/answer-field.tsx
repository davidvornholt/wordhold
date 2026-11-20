import type { RefObject } from 'react';
import type { CharacterSet } from '../practice/answer-characters';
import { CharacterPalette } from './character-palette';
import {
  answerFieldStates,
  answerLineType,
  answerPageType,
} from './field-styles';
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
  // The answer has been judged and stays on the card as it was written, so
  // its line goes.
  readonly judged?: boolean;
  // A word to write over: its letters stand faint on the line ahead of what
  // is typed, for as long as the typing follows them.
  readonly trace?: string;
  readonly placeholder?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
};

const lineColor = (missed: boolean, judged: boolean): string => {
  if (judged) {
    return 'border-transparent';
  }
  return missed
    ? 'border-warning-foreground'
    : 'border-input focus-visible:border-ring';
};

// What of the traced word is still ahead of the typing, or null once the
// typing has left it.
const traceAhead = (trace: string, value: string): string | null =>
  trace.toLowerCase().startsWith(value.toLowerCase())
    ? trace.slice(value.length)
    : null;

// A copy of the field's text laid under it in the same type and width. It
// sets the height of a field that wraps, which grows with its text in every
// browser, and it shows the rest of a traced word right after the typing.
const FieldShadow = ({
  className,
  placeholder,
  trace,
  value,
}: {
  readonly className: string;
  readonly placeholder: string | undefined;
  readonly trace: string | undefined;
  readonly value: string;
}) => {
  const ahead = trace === undefined ? null : traceAhead(trace, value);
  const written =
    value === '' && trace === undefined ? (placeholder ?? '') : value;
  return (
    <div
      aria-hidden="true"
      className={`${className} wrap-break-word pointer-events-none select-none whitespace-pre-wrap border-transparent`}
    >
      <span className="invisible">{written}</span>
      {ahead === null ? null : (
        <span className="text-muted-foreground/70">{ahead}</span>
      )}
      {/* A line break at the very end still takes a line in the field. */}
      <span className="invisible"> </span>
    </div>
  );
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
  judged = false,
  trace,
  onChange,
  ...field
}: AnswerFieldProps) => {
  // A traced word is one line, but the field wraps like the copy beneath it,
  // so the faint letters stay right behind the typed ones.
  const wraps = multiline || trace !== undefined;
  // Room for the palette's toggle, so text never runs beneath it.
  const toggleRoom = characters === null ? '' : 'pr-13';
  const type = `${multiline ? answerPageType : answerLineType} ${toggleRoom} col-start-1 row-start-1`;
  // The answer has to come from memory: neither the browser nor the keyboard
  // may correct it, suggest words, or mark a misspelling before it is sent.
  const shared = {
    ...field,
    autoCapitalize: 'off',
    autoComplete: 'off',
    autoCorrect: 'off',
    spellCheck: false,
    className: `${type} ${answerFieldStates} ${lineColor(missed, judged)}`,
  };
  const attach = (node: AnswerFieldElement | null) => {
    fieldRef.current = node;
  };
  return (
    <div className="grid gap-3">
      {wraps ? (
        <>
          <FieldShadow
            className={type}
            placeholder={field.placeholder}
            trace={trace}
            value={field.value}
          />
          <textarea
            {...shared}
            className={`${shared.className} resize-none overflow-hidden`}
            onChange={(event) =>
              onChange(
                multiline
                  ? event.target.value
                  : event.target.value.replaceAll('\n', ''),
              )
            }
            onKeyDown={submitOnEnter}
            ref={attach}
            rows={1}
          />
        </>
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
