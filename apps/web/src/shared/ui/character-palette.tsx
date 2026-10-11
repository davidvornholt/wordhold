import { type MouseEvent, type RefObject, useId, useState } from 'react';
import type { AnswerFieldElement } from './answer-field';
import { Button } from './button';
import {
  rememberPreference,
  useRememberedPreference,
} from './remembered-preference';

type PaletteCharacter = {
  readonly character: string;
  readonly name: string;
};

const digits = (
  marks: string,
  position: string,
): ReadonlyArray<PaletteCharacter> =>
  [...marks].map((character, digit) => ({
    character,
    name: `${position} ${digit}`,
  }));

// Formulas and units need characters that phone keyboards do not offer.
const characterGroups: ReadonlyArray<{
  readonly label: string;
  readonly characters: ReadonlyArray<PaletteCharacter>;
}> = [
  { label: 'Tiefgestellt', characters: digits('₀₁₂₃₄₅₆₇₈₉', 'tiefgestellt') },
  {
    label: 'Hochgestellt',
    characters: [
      ...digits('⁰¹²³⁴⁵⁶⁷⁸⁹', 'hochgestellt'),
      { character: '⁺', name: 'hochgestellt plus' },
      { character: '⁻', name: 'hochgestellt minus' },
    ],
  },
  {
    label: 'Zeichen',
    characters: [
      { character: '→', name: 'Pfeil' },
      { character: '⇌', name: 'Gleichgewichtspfeil' },
      { character: '°', name: 'Grad' },
      { character: '·', name: 'Malpunkt' },
      { character: '×', name: 'Malkreuz' },
      { character: '±', name: 'plus minus' },
      { character: 'Δ', name: 'Delta' },
      { character: '≈', name: 'ungefähr' },
      { character: '≤', name: 'kleiner gleich' },
      { character: '≥', name: 'größer gleich' },
    ],
  },
];

const storageKey = 'wordhold-character-palette';

// Typed at the cursor, as if from the keyboard. React learns of a value set
// from code only through an input event.
const insertAtCursor = (field: AnswerFieldElement, text: string) => {
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

// Characters to add to an answer field. It stays open or closed across cards
// once chosen, since a subject that needs it needs it on every card.
export const CharacterPalette = ({
  disabled,
  fieldRef,
}: {
  readonly disabled: boolean;
  readonly fieldRef: RefObject<AnswerFieldElement | null>;
}) => {
  const paletteId = useId();
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
    <div className="flex flex-col gap-2">
      <Button
        aria-controls={paletteId}
        aria-expanded={open}
        className="w-fit self-start px-1"
        onClick={toggle}
        onMouseDown={keepFieldFocus}
        variant="quiet-muted"
      >
        Sonderzeichen
      </Button>
      <div className="flex flex-col gap-2" hidden={!open} id={paletteId}>
        {characterGroups.map((group) => (
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
    </div>
  );
};
