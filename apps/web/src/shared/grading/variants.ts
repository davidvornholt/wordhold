import {
  type AnswerVariantExpansion,
  type ExpansionState,
  flatMapBounded,
  maximumAnswerVariants,
  normalizeReadings,
} from './bounded-variant-expansion';

const optionalGroup = /\((?<inner>[^()]*)\)/u;
const whitespace = /\s+/u;
const spacedPhraseSeparator = /(?:\s+\/\s*|\s*\/\s+)/u;
const semicolonSeparator = /\s*;\s*/u;
const lowercaseWord = /^\p{Ll}+$/u;
const uppercaseStart = /^\p{Lu}/u;
const phraseEnd = /^[\s]*(?:;|$)/u;
const whitespaceCharacter = /\s/u;
const compactSlashWithFlexibleSpacing =
  /(?<left>\p{Ll}+)\s*\/\s*(?<right>\p{Ll}+)/gu;
const compactSuffixReplacements: ReadonlyArray<{
  readonly fullEnding: string;
  readonly shorthand: string;
  readonly alternativeEnding: string;
}> = [
  { fullEnding: 'teur', shorthand: 'trice', alternativeEnding: 'trice' },
  { fullEnding: 'if', shorthand: 'ive', alternativeEnding: 'ive' },
  { fullEnding: 'o', shorthand: 'a', alternativeEnding: 'a' },
  { fullEnding: 'or', shorthand: 'a', alternativeEnding: 'ora' },
];
const compactWordAlternatives = new Set(['be/get', 'der/die']);
const compactSlashReadings = (
  left: string,
  right: string,
): ReadonlyArray<string> | undefined => {
  const suffixReplacement = compactSuffixReplacements.find(
    ({ fullEnding, shorthand }) =>
      right === shorthand && left.endsWith(fullEnding),
  );
  if (suffixReplacement !== undefined) {
    return [
      left,
      `${left.slice(0, -suffixReplacement.fullEnding.length)}${suffixReplacement.alternativeEnding}`,
    ];
  }
  if (compactWordAlternatives.has(`${left}/${right}`)) {
    return [left, right];
  }
  return undefined;
};

const normalizeCompactSlashSpacing = (text: string): string => {
  let normalized = '';
  let cursor = 0;
  for (const match of text.matchAll(compactSlashWithFlexibleSpacing)) {
    const left = match.groups?.left ?? '';
    const right = match.groups?.right ?? '';
    const readings = compactSlashReadings(left, right);
    const isSuffixShorthand =
      readings !== undefined &&
      !compactWordAlternatives.has(`${left}/${right}`);
    const slashIndex = match[0].indexOf('/');
    const hasOneSidedWhitespace =
      whitespaceCharacter.test(match[0].slice(0, slashIndex)) !==
      whitespaceCharacter.test(match[0].slice(slashIndex + 1));
    const endsPhrase = phraseEnd.test(
      text.slice(match.index + match[0].length),
    );
    const isAmbiguousOneSidedSpacing =
      readings === undefined &&
      hasOneSidedWhitespace &&
      !right.startsWith(left);
    const preserveSpacing =
      (readings === undefined && !isAmbiguousOneSidedSpacing) ||
      (isSuffixShorthand && !endsPhrase);
    const replacement = preserveSpacing ? match[0] : `${left}/${right}`;
    normalized += text.slice(cursor, match.index) + replacement;
    cursor = match.index + match[0].length;
  }
  return normalized + text.slice(cursor);
};

const hasSimpleParentheses = (text: string): boolean => {
  let depth = 0;
  for (const character of text) {
    if (character === '(') {
      depth += 1;
      if (depth > 1) {
        return false;
      }
    } else if (character === ')') {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }
  return depth === 0;
};

const expandOptionalGroups = (text: string): ExpansionState => {
  if (!hasSimpleParentheses(text)) {
    return { _tag: 'Values', values: [text] };
  }
  let state: ExpansionState = { _tag: 'Values', values: [text] };
  while (state._tag === 'Values') {
    if (!state.values.some((value) => optionalGroup.test(value))) {
      return state;
    }
    state = flatMapBounded(state.values, (value) => {
      const match = optionalGroup.exec(value);
      if (match === null) {
        return [value];
      }
      const before = value.slice(0, match.index);
      const after = value.slice(match.index + match[0].length);
      const inner = match.groups?.inner ?? '';
      return [`${before}${inner}${after}`, `${before}${after}`];
    });
  }
  return state;
};

const splitPhraseAlternatives = (text: string): ReadonlyArray<string> => {
  const semicolon = text.split(semicolonSeparator);
  const nonEmptySemicolonParts = semicolon.filter((part) => part.trim() !== '');
  if (semicolon.length > 1 && nonEmptySemicolonParts.length > 0) {
    return nonEmptySemicolonParts.flatMap(splitPhraseAlternatives);
  }
  const spaced = text.split(spacedPhraseSeparator);
  if (spaced.length > 1 && spaced.every((part) => part.trim() !== '')) {
    return spaced;
  }
  const slash = text.indexOf('/');
  if (slash < 0 || slash !== text.lastIndexOf('/')) {
    return [text];
  }
  const left = text.slice(0, slash);
  const right = text.slice(slash + 1);
  const leftWords = left.trim().split(whitespace);
  const rightWords = right.trim().split(whitespace);
  const leftLast = leftWords.at(-1) ?? '';
  if (
    leftWords.length > 1 &&
    rightWords.length > 1 &&
    uppercaseStart.test(leftLast)
  ) {
    return [left, right];
  }
  return [text];
};

const expandSlashWord = (word: string): ExpansionState => {
  const parts = word.split('/');
  if (parts.length !== 2) {
    return { _tag: 'Values', values: [word] };
  }
  const [left = '', right = ''] = parts;
  if (!(lowercaseWord.test(left) && lowercaseWord.test(right))) {
    return { _tag: 'Values', values: [word] };
  }
  const readings = compactSlashReadings(left, right);
  return readings === undefined
    ? { _tag: 'Overflow' }
    : { _tag: 'Values', values: readings };
};

const expandWordAlternatives = (text: string): ExpansionState => {
  let state: ExpansionState = { _tag: 'Values', values: [''] };
  for (const word of text.split(whitespace).filter((part) => part !== '')) {
    if (state._tag === 'Overflow') {
      return state;
    }
    const wordExpansion = expandSlashWord(word);
    if (wordExpansion._tag === 'Overflow') {
      return wordExpansion;
    }
    state = flatMapBounded(state.values, (sentence) =>
      wordExpansion.values.map((part) =>
        sentence === '' ? part : `${sentence} ${part}`,
      ),
    );
  }
  return state;
};

export const answerVariants = (text: string): AnswerVariantExpansion => {
  const phrases: Array<string> = [];
  for (const phrase of splitPhraseAlternatives(
    normalizeCompactSlashSpacing(text),
  )) {
    const optional = expandOptionalGroups(phrase);
    if (optional._tag === 'Overflow') {
      return optional;
    }
    if (phrases.length + optional.values.length > maximumAnswerVariants) {
      return { _tag: 'Overflow' };
    }
    phrases.push(...optional.values);
  }
  return normalizeReadings(phrases, expandWordAlternatives);
};
