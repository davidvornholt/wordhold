import type { CourseKind, LanguageCode } from '@wordhold/db/schema/courses';

type PaletteCharacter = {
  readonly character: string;
  readonly name: string;
};

type CharacterGroup = {
  readonly label: string;
  readonly characters: ReadonlyArray<PaletteCharacter>;
};

export type CharacterSet = {
  // Names the open or closed choice this browser remembers for the set.
  readonly key: string;
  // Shown on the toggle as a sample of what the palette holds.
  readonly sample: string;
  readonly groups: ReadonlyArray<CharacterGroup>;
};

const digits = (
  marks: string,
  position: string,
): ReadonlyArray<PaletteCharacter> =>
  [...marks].map((character, digit) => ({
    character,
    name: `${position} ${digit}`,
  }));

// Each letter is named by its base letter and the mark it carries.
const marked = (
  letters: string,
  mark: string,
): ReadonlyArray<PaletteCharacter> =>
  [...letters].map((character) => ({
    character,
    name: `${character.normalize('NFD').charAt(0)} mit ${mark}`,
  }));

// Formulas and units need characters that phone keyboards do not offer.
const formulaCharacters: CharacterSet = {
  key: 'formulas',
  sample: 'x²',
  groups: [
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
  ],
};

// A German keyboard reaches some accents only through dead keys and lacks
// the rest, and a missing accent fails an answer's spelling.
const spanishCharacters: CharacterSet = {
  key: 'es',
  sample: 'ñ',
  groups: [
    {
      label: 'Spanische Zeichen',
      characters: [
        ...marked('áéíóú', 'Akut'),
        ...marked('ñ', 'Tilde'),
        { character: '¿', name: 'umgekehrtes Fragezeichen' },
        { character: '¡', name: 'umgekehrtes Ausrufezeichen' },
      ],
    },
  ],
};

const frenchCharacters: CharacterSet = {
  key: 'fr',
  sample: 'é',
  groups: [
    {
      label: 'Französische Zeichen',
      characters: [
        ...marked('é', 'Akut'),
        ...marked('èàù', 'Gravis'),
        ...marked('êâîôû', 'Zirkumflex'),
        ...marked('ëï', 'Trema'),
        ...marked('ç', 'Cedille'),
        { character: 'œ', name: 'o e Ligatur' },
      ],
    },
  ],
};

// German is written on the learner's own keyboard, and English needs nothing
// beyond it.
const languageCharacters = {
  de: null,
  en: null,
  es: spanishCharacters,
  fr: frenchCharacters,
} as const satisfies Record<LanguageCode, CharacterSet | null>;

// The characters an answer may need that the keyboard lacks. A text is
// recited, so it needs none.
export const answerCharacters = (
  kind: CourseKind,
  language: LanguageCode,
): CharacterSet | null => {
  switch (kind) {
    case 'terms':
      return formulaCharacters;
    case 'texts':
      return null;
    case 'language':
      return languageCharacters[language];
    default:
      return kind satisfies never;
  }
};
