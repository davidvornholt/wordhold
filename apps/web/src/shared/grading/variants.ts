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
const suffixWord = /^-?\p{Ll}+$/u;
const articlePair =
  /^(?:el\/la|la\/el|un\/una|una\/un|le\/la|la\/le|un\/une|une\/un|der\/die|die\/der|ein\/eine|eine\/ein)$/u;
const optionalArticle = /^(?:ein\(e\)|un\(e\))\s/u;
const feminineFirst = /^(?:la|una|une|die|eine)\//u;
const phraseArticle = /^(?:el|la|un|una|le|une|der|die|ein|eine)$/u;
const uppercaseStart = /^\p{Lu}/u;
const phraseEnd = /^[\s]*(?:;|$)/u;
const whitespaceCharacter = /\s/u;
// Consume only the separator so adjacent slashes can share a word.
const compactSlashWithFlexibleSpacing =
  /(?<=(?<left>\p{Ll}+))\s*\/\s*(?=(?<right>-?\p{Ll}+))/gu;
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
// Article pairs the books write compactly ("el/la tenista", "un/une ami"),
// besides the verb pair English lists use.
const compactWordAlternatives = new Set([
  'be/get',
  'der/die',
  'die/der',
  'ein/eine',
  'eine/ein',
  'el/la',
  'la/el',
  'un/una',
  'una/un',
  'le/la',
  'la/le',
  'un/une',
  'une/un',
]);
const compactSlashReadings = (
  left: string,
  right: string,
): ReadonlyArray<string> | undefined => {
  const suffixReplacement = compactSuffixReplacements.find(
    ({ fullEnding, shorthand }) =>
      (right.startsWith('-') ? right.slice(1) : right) === shorthand &&
      left.endsWith(fullEnding),
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
      text.slice(match.index + match[0].length + right.length),
    );
    const isAmbiguousOneSidedSpacing =
      readings === undefined &&
      hasOneSidedWhitespace &&
      !right.startsWith(left);
    const currentPhraseStart =
      (normalized + text.slice(cursor, match.index))
        .split(semicolonSeparator)
        .at(-1)
        ?.split(spacedPhraseSeparator)
        .at(-1)
        ?.trim()
        .split(whitespace)[0] ?? '';
    // A suffix after paired articles stays attached even inside a phrase,
    // so the agreement guard can delegate longer chains to the judge.
    const preserveSpacing =
      (readings === undefined && !isAmbiguousOneSidedSpacing) ||
      (isSuffixShorthand &&
        !endsPhrase &&
        !articlePair.test(currentPhraseStart));
    const replacement = preserveSpacing ? match[0] : '/';
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
  // Agreement in compound shorthand is not an independent optional choice.
  // Delegate ambiguous forms such as eine/ein Angestellte(r) to the judge.
  if (
    optionalArticle.test(text.trim()) ||
    (articlePair.test(text.trim().split(whitespace)[0] ?? '') &&
      optionalGroup.test(text))
  ) {
    return { _tag: 'Overflow' };
  }
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
    (uppercaseStart.test(leftLast) ||
      (phraseArticle.test(leftWords[0] ?? '') &&
        phraseArticle.test(rightWords[0] ?? '')))
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
  if (!(lowercaseWord.test(left) && suffixWord.test(right))) {
    return { _tag: 'Values', values: [word] };
  }
  const readings = compactSlashReadings(left, right);
  return readings === undefined
    ? { _tag: 'Overflow' }
    : { _tag: 'Values', values: readings };
};

const expandArticleAndNoun = (words: ReadonlyArray<string>): ExpansionState => {
  const first = words[0] ?? '';
  // A noun's masculine/feminine endings must stay paired with its article.
  // Longer agreement chains require grammar knowledge, so fail closed.
  if (words.length !== 2) {
    return { _tag: 'Overflow' };
  }
  const noun = expandSlashWord(words[1] ?? '');
  if (noun._tag === 'Overflow' || noun.values.length !== 2) {
    return { _tag: 'Overflow' };
  }
  const nouns = feminineFirst.test(first)
    ? [...noun.values].reverse()
    : noun.values;
  return {
    _tag: 'Values',
    values: first
      .split('/')
      .map((article, index) => `${article} ${nouns[index]}`),
  };
};

const expandWordAlternatives = (text: string): ExpansionState => {
  const words = text.split(whitespace).filter((part) => part !== '');
  const first = words[0] ?? '';
  if (
    articlePair.test(first) &&
    words.slice(1).some((word) => word.includes('/'))
  ) {
    return expandArticleAndNoun(words);
  }
  let state: ExpansionState = { _tag: 'Values', values: [''] };
  for (const word of words) {
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
