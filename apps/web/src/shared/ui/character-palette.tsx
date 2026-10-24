import { type MouseEvent, type RefObject, useId, useState } from 'react';
import type { CharacterSet } from '../practice/answer-characters';
import { Button } from './button';
import {
  rememberPreference,
  useRememberedPreference,
} from './remembered-preference';

type PaletteField = HTMLInputElement | HTMLTextAreaElement;

// Typed at the cursor, as if from the keyboard. React learns of a value set
// from code only through an input event.
const insertAtCursor = (field: PaletteField, text: string) => {
  const end = field.value.length;
  field.setRangeText(
    text,
    field.selectionStart ?? end,
    field.selectionEnd ?? end,
    'end',
  );
  field.dispatchEvent(new Event('input', { bubbles: true }));
};

// A tap would otherwise move focus off the field and close the phone's
// keyboard. Keyboard users keep focus on the palette instead.
const keepFieldFocus = (event: MouseEvent) => event.preventDefault();

// Characters to add to an answer field. The toggle sits inside the field's
// border, so a closed palette takes no room. It stays open or closed across
// cards once chosen, since a subject that needs it needs it on every card.
// Rendered in the field's grid, after the field: the toggle shares the
// field's cell and the characters take the row beneath.
export const CharacterPalette = ({
  characters,
  disabled,
  fieldRef,
  multiline,
}: {
  readonly characters: CharacterSet;
  readonly disabled: boolean;
  readonly fieldRef: RefObject<PaletteField | null>;
  // Beside one line the toggle is as tall as the field; a field that wraps
  // keeps it in the corner.
  readonly multiline: boolean;
}) => {
  const paletteId = useId();
  const storageKey = `wordhold-character-palette-${characters.key}`;
  const remembered = useRememberedPreference(storageKey) === 'open';
  const [chosen, setChosen] = useState<boolean | null>(null);
  const open = chosen ?? remembered;
  const toggle = () => {
    setChosen(!open);
    rememberPreference(storageKey, open ? 'closed' : 'open');
  };
  const insert = (character: string) => {
    if (fieldRef.current !== null) {
      insertAtCursor(fieldRef.current, character);
    }
  };
  return (
    <>
      <Button
        aria-controls={paletteId}
        aria-expanded={open}
        aria-label={`${characters.sample} Sonderzeichen`}
        className={`col-start-1 row-start-1 m-px justify-self-end text-base aria-expanded:bg-muted aria-expanded:text-foreground ${multiline ? 'self-start' : 'self-stretch'}`}
        onClick={toggle}
        onMouseDown={keepFieldFocus}
        title="Sonderzeichen"
        variant="icon"
      >
        <span aria-hidden="true">{characters.sample}</span>
      </Button>
      <div
        className="col-start-1 row-start-2 flex flex-col gap-2"
        hidden={!open}
        id={paletteId}
      >
        {characters.groups.map((group) => (
          <fieldset className="flex flex-wrap gap-1" key={group.label}>
            <legend className="sr-only">{group.label}</legend>
            {group.characters.map(({ character, name }) => (
              <button
                aria-label={name}
                className="min-h-11 min-w-11 border border-input bg-card text-lg focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:opacity-50"
                disabled={disabled}
                key={character}
                onClick={() => insert(character)}
                onMouseDown={keepFieldFocus}
                type="button"
              >
                {character}
              </button>
            ))}
          </fieldset>
        ))}
      </div>
    </>
  );
};
