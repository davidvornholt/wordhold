// A text learned by heart is compared word for word with its original. Only
// the words count: case, punctuation and line breaks are not what is being
// memorized, and umlauts typed as "ae" or a "ß" typed as "ss" are the same
// word.
export type RecitedWord = {
  // As written, for display.
  readonly text: string;
  readonly key: string;
  // Position in the text it came from.
  readonly start: number;
  readonly end: number;
};

// One step of the alignment, in the order of the original. A typo is a word
// that is clearly the right one with a single slip; a wrong word is another
// word in its place.
export type RecitationStep =
  | { readonly kind: 'same'; readonly expected: RecitedWord }
  | {
      readonly kind: 'typo' | 'wrong';
      readonly expected: RecitedWord;
      readonly typed: RecitedWord;
    }
  | { readonly kind: 'missing'; readonly expected: RecitedWord }
  | { readonly kind: 'extra'; readonly typed: RecitedWord };

export type Recitation = {
  readonly steps: ReadonlyArray<RecitationStep>;
  // Words in the original.
  readonly words: number;
  // Wrong, missing and extra words. A typo is not a mistake.
  readonly mistakes: number;
  readonly typos: number;
};

const wordPattern = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;
const apostrophes = /['’]/gu;
const foldedLetters = new Map([
  ['ß', 'ss'],
  ['ä', 'ae'],
  ['ö', 'oe'],
  ['ü', 'ue'],
]);
const foldable = /[ßäöü]/gu;

const comparisonKey = (word: string): string =>
  word
    .normalize('NFC')
    .toLowerCase()
    .replace(apostrophes, '')
    .replace(foldable, (letter) => foldedLetters.get(letter) ?? letter);

export const recitedWords = (text: string): ReadonlyArray<RecitedWord> =>
  Array.from(text.matchAll(wordPattern), (match) => ({
    text: match[0],
    key: comparisonKey(match[0]),
    start: match.index,
    end: match.index + match[0].length,
  }));

// Optimal string alignment distance, capped: only whether two words are at
// most one edit apart matters.
const withinOneEdit = (left: string, right: string): boolean => {
  if (Math.abs(left.length - right.length) > 1) {
    return false;
  }
  let start = 0;
  while (start < left.length && left[start] === right[start]) {
    start += 1;
  }
  const leftRest = left.slice(start + 1);
  const rightRest = right.slice(start + 1);
  return (
    leftRest === rightRest ||
    left.slice(start) === right.slice(start + 1) ||
    left.slice(start + 1) === right.slice(start) ||
    (left[start] === right[start + 1] &&
      left[start + 1] === right[start] &&
      left.slice(start + 2) === right.slice(start + 2))
  );
};

// Short words differ by one letter from other real words ("dem" and "den"),
// so only longer words can count as a typo.
const typoMinimumLength = 5;

const isTypo = (expected: string, typed: string): boolean =>
  expected.length >= typoMinimumLength && withinOneEdit(expected, typed);

// Costs in half mistakes, so a typo is cheaper than a wrong word and a wrong
// word cheaper than a missing plus an extra one.
const cost = { same: 0, typo: 1, wrong: 2, gap: 2 } as const;

const substitutionCost = (expected: string, typed: string): number => {
  if (expected === typed) {
    return cost.same;
  }
  return isTypo(expected, typed) ? cost.typo : cost.wrong;
};

const alignmentCosts = (
  expected: ReadonlyArray<RecitedWord>,
  typed: ReadonlyArray<RecitedWord>,
): Uint32Array => {
  const columns = typed.length + 1;
  const costs = new Uint32Array((expected.length + 1) * columns);
  for (let column = 1; column < columns; column += 1) {
    costs[column] = column * cost.gap;
  }
  for (let row = 1; row <= expected.length; row += 1) {
    costs[row * columns] = row * cost.gap;
    const want = expected[row - 1]?.key ?? '';
    for (let column = 1; column < columns; column += 1) {
      const got = typed[column - 1]?.key ?? '';
      costs[row * columns + column] = Math.min(
        (costs[(row - 1) * columns + column - 1] ?? 0) +
          substitutionCost(want, got),
        (costs[(row - 1) * columns + column] ?? 0) + cost.gap,
        (costs[row * columns + column - 1] ?? 0) + cost.gap,
      );
    }
  }
  return costs;
};

const alignedPair = (want: RecitedWord, got: RecitedWord): RecitationStep => {
  if (want.key === got.key) {
    return { kind: 'same', expected: want };
  }
  return {
    kind: isTypo(want.key, got.key) ? 'typo' : 'wrong',
    expected: want,
    typed: got,
  };
};

// Walks back through the costs. On a tie, pairing two words wins over a
// missing word, and a missing word over an extra one.
const alignedSteps = (
  expected: ReadonlyArray<RecitedWord>,
  typed: ReadonlyArray<RecitedWord>,
): ReadonlyArray<RecitationStep> => {
  const costs = alignmentCosts(expected, typed);
  const columns = typed.length + 1;
  const at = (rowIndex: number, columnIndex: number) =>
    costs[rowIndex * columns + columnIndex] ?? 0;
  const steps: Array<RecitationStep> = [];
  let row = expected.length;
  let column = typed.length;
  while (row > 0 || column > 0) {
    const want = expected[row - 1];
    const got = typed[column - 1];
    const here = at(row, column);
    if (
      want !== undefined &&
      got !== undefined &&
      here === at(row - 1, column - 1) + substitutionCost(want.key, got.key)
    ) {
      steps.push(alignedPair(want, got));
      row -= 1;
      column -= 1;
    } else if (want !== undefined && here === at(row - 1, column) + cost.gap) {
      steps.push({ kind: 'missing', expected: want });
      row -= 1;
    } else if (got === undefined) {
      break;
    } else {
      steps.push({ kind: 'extra', typed: got });
      column -= 1;
    }
  }
  return steps.reverse();
};

export const compareRecitation = (
  original: string,
  recited: string,
): Recitation => {
  const expected = recitedWords(original);
  const steps = alignedSteps(expected, recitedWords(recited));
  return {
    steps,
    words: expected.length,
    mistakes: steps.filter(
      (step) => step.kind !== 'same' && step.kind !== 'typo',
    ).length,
    typos: steps.filter((step) => step.kind === 'typo').length,
  };
};

// Up to one mistake per ten words still counts as known, though not well. A
// text under ten words has to be word-perfect.
export const allowedMistakes = (words: number): number =>
  Math.floor(words / 10);

// A copy shown on screen has no excuse for typos either.
export const isVerbatimCopy = (original: string, typed: string): boolean => {
  const { mistakes, typos } = compareRecitation(original, typed);
  return mistakes === 0 && typos === 0;
};

// What the feedback shows: the original with its own punctuation and line
// breaks, each word marked, and extra words where they were typed.
export type RecitationSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'same' | 'missing'; readonly text: string }
  | {
      readonly kind: 'typo' | 'wrong';
      readonly text: string;
      readonly typed: string;
    }
  | { readonly kind: 'extra'; readonly typed: string };

export const recitationSegments = (
  original: string,
  recitation: Recitation,
): ReadonlyArray<RecitationSegment> => {
  const segments: Array<RecitationSegment> = [];
  let extras: Array<string> = [];
  let cursor = 0;
  const pushText = (text: string) => {
    if (text !== '') {
      segments.push({ kind: 'text', text });
    }
  };
  for (const step of recitation.steps) {
    if (step.kind === 'extra') {
      extras.push(step.typed.text);
    } else {
      pushText(original.slice(cursor, step.expected.start));
      for (const typed of extras) {
        segments.push({ kind: 'extra', typed }, { kind: 'text', text: ' ' });
      }
      extras = [];
      const { text } = step.expected;
      segments.push(
        step.kind === 'typo' || step.kind === 'wrong'
          ? { kind: step.kind, text, typed: step.typed.text }
          : { kind: step.kind, text },
      );
      cursor = step.expected.end;
    }
  }
  pushText(original.slice(cursor));
  for (const typed of extras) {
    segments.push({ kind: 'text', text: ' ' }, { kind: 'extra', typed });
  }
  return segments;
};

const shownWords = 6;

type MissingStep = Extract<RecitationStep, { readonly kind: 'missing' }>;

const isMissing = (step: RecitationStep): step is MissingStep =>
  step.kind === 'missing';

const excerpt = (words: ReadonlyArray<RecitedWord>): string => {
  const shown = words.slice(0, shownWords).map((word) => word.text);
  return words.length > shownWords ? `${shown.join(' ')} …` : shown.join(' ');
};

// Where a copy of the text first departs from it, so the learner can fix
// that spot instead of writing the whole text again. Null when it matches.
export const copyMistakeMessage = (
  original: string,
  typed: string,
): string | null => {
  const { steps } = compareRecitation(original, typed);
  const index = steps.findIndex((candidate) => candidate.kind !== 'same');
  const step = steps[index];
  if (step === undefined) {
    return null;
  }
  const position =
    steps.slice(0, index).filter((earlier) => earlier.kind !== 'extra').length +
    1;
  switch (step.kind) {
    case 'typo':
    case 'wrong':
      return `Noch nicht ganz: Das ${position}. Wort ist „${step.expected.text}“, nicht „${step.typed.text}“.`;
    case 'missing': {
      const rest = steps.slice(index);
      if (rest.every(isMissing)) {
        return `Noch nicht ganz: Es fehlt noch „${excerpt(rest.map((later) => later.expected))}“.`;
      }
      return `Noch nicht ganz: Als ${position}. Wort fehlt „${step.expected.text}“.`;
    }
    case 'extra':
      return `Noch nicht ganz: „${step.typed.text}“ gehört nicht dazu.`;
    case 'same':
      return null;
    default:
      return step satisfies never;
  }
};
