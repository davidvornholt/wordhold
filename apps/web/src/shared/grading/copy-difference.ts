import { normalizeAnswerForComparison } from './normalize';

// Where a copied definition first departs from the original, word by word
// under the grading normalization. A definition is too long to retype from
// scratch after every slip, so the learner is pointed at the spot to fix.
export type CopyDifference =
  | {
      readonly kind: 'wrong-word';
      // 1-based, counted in the original.
      readonly position: number;
      readonly expected: string;
      readonly typed: string;
    }
  | { readonly kind: 'missing'; readonly rest: string }
  | { readonly kind: 'extra'; readonly rest: string };

type Word = { readonly text: string; readonly normalized: string };

// A comma also ends a word when no space follows it ("Stoff,der").
const wordBoundary = /\s+|(?<=,)(?=\S)/u;

const words = (text: string): ReadonlyArray<Word> =>
  text
    .split(wordBoundary)
    .map((word) => ({
      text: word,
      normalized: normalizeAnswerForComparison(word),
    }))
    .filter((word) => word.normalized !== '');

const shownWords = 6;

const excerpt = (rest: ReadonlyArray<Word>): string => {
  const shown = rest.slice(0, shownWords).map((word) => word.text);
  return rest.length > shownWords ? `${shown.join(' ')} …` : shown.join(' ');
};

// Null when the words match; the caller then falls back to a general hint.
export const copyDifference = (
  expected: string,
  typed: string,
): CopyDifference | null => {
  const original = words(expected);
  const copy = words(typed);
  const shared = Math.min(original.length, copy.length);
  for (let index = 0; index < shared; index += 1) {
    const want = original[index];
    const got = copy[index];
    if (
      want !== undefined &&
      got !== undefined &&
      want.normalized !== got.normalized
    ) {
      return {
        kind: 'wrong-word',
        position: index + 1,
        expected: want.text,
        typed: got.text,
      };
    }
  }
  if (copy.length < original.length) {
    return { kind: 'missing', rest: excerpt(original.slice(shared)) };
  }
  if (copy.length > original.length) {
    return { kind: 'extra', rest: excerpt(copy.slice(shared)) };
  }
  return null;
};

export const copyDifferenceMessage = (
  difference: CopyDifference | null,
): string => {
  if (difference === null) {
    return 'Noch nicht ganz. Vergleich deine Abschrift mit der Definition.';
  }
  switch (difference.kind) {
    case 'wrong-word':
      return `Noch nicht ganz: Das ${difference.position}. Wort ist „${difference.expected}“, nicht „${difference.typed}“.`;
    case 'missing':
      return `Noch nicht ganz: Es fehlt noch „${difference.rest}“.`;
    case 'extra':
      return `Noch nicht ganz: „${difference.rest}“ gehört nicht dazu.`;
    default:
      return difference satisfies never;
  }
};
