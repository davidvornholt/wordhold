import type {
  PitfallSuggestion,
  SpellingPitfall,
  SpellingSegment,
} from './schema';

// The model names the letters to learn and a typical misspelling. Only the
// letters the misspelling actually gets wrong are marked: the model cannot
// count letters reliably, and a mark it cannot back with a mistake points
// the learner to the wrong place.
const escapedPattern = /[.*+?^${}()|[\]\\]/gu;
// The rest of the word the marks stand in, up to the surrounding spaces.
const wordTail = /\S*$/u;
const wordHead = /\s|$/u;

const wordPattern = (word: string, flags: string) =>
  new RegExp(
    `(?<!\\p{L})${word.replace(escapedPattern, '\\$&')}(?!\\p{L})`,
    flags,
  );

const positionsBetween = (start: number, end: number) =>
  Array.from({ length: end - start }, (_, offset) => start + offset);

// How `word` lines up with the misspelling along their longest common
// subsequence: the positions in `word` the misspelling leaves out or
// replaces, and the letters it adds before a position.
const align = (
  word: string,
  misspelling: string,
): {
  readonly missing: ReadonlyArray<number>;
  readonly added: ReadonlyMap<number, string>;
} => {
  const width = misspelling.length + 1;
  // The longest common subsequence of word.slice(i) and misspelling.slice(j).
  const common = new Array<number>((word.length + 1) * width).fill(0);
  const at = (row: number, column: number) => common[row * width + column] ?? 0;
  for (let i = word.length - 1; i >= 0; i -= 1) {
    for (let j = misspelling.length - 1; j >= 0; j -= 1) {
      common[i * width + j] =
        word[i] === misspelling[j]
          ? at(i + 1, j + 1) + 1
          : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const missing: Array<number> = [];
  const added = new Map<number, string>();
  let i = 0;
  let j = 0;
  while (i < word.length || j < misspelling.length) {
    if (word[i] === misspelling[j]) {
      i += 1;
      j += 1;
    } else if (j < misspelling.length && at(i, j + 1) >= at(i + 1, j)) {
      added.set(i, `${added.get(i) ?? ''}${misspelling.charAt(j)}`);
      j += 1;
    } else {
      missing.push(i);
      i += 1;
    }
  }
  return { missing, added };
};

// The positions in `word` that the misspelling gets wrong. A letter it moves
// rather than drops marks the letters it moves across, as in recieve for
// receive. A misspelling that only adds letters gets none of them wrong; the
// neighbour it doubles, or else both neighbours, stand for each addition.
const changedPositions = (
  word: string,
  misspelling: string,
): ReadonlyArray<number> => {
  const { missing, added } = align(word, misspelling);
  const additions = [...added];
  if (missing.length > 0) {
    const moved = missing.flatMap((position) =>
      additions.flatMap(([point, letters]) =>
        letters.includes(word.charAt(position))
          ? positionsBetween(
              Math.min(point, position),
              Math.max(point, position + 1),
            )
          : [],
      ),
    );
    return [...missing, ...moved];
  }
  return additions.flatMap(([point, letters]) => {
    const neighbours = [point - 1, point].filter(
      (position) => position >= 0 && position < word.length,
    );
    const doubled = neighbours.filter((position) =>
      letters.includes(word.charAt(position)),
    );
    return doubled.length > 0 ? doubled : neighbours;
  });
};

// The positions of the named letters that the misspelling gets wrong.
const markedPositions = ({
  word,
  letters,
  misspelling,
}: PitfallSuggestion): ReadonlySet<number> => {
  const named = new Set<number>();
  // An empty group would match everywhere and never advance.
  for (const group of letters.filter((letter) => letter !== '')) {
    for (
      let at = word.indexOf(group);
      at !== -1;
      at = word.indexOf(group, at + 1)
    ) {
      for (let position = at; position < at + group.length; position += 1) {
        named.add(position);
      }
    }
  }
  return new Set(
    changedPositions(word, misspelling).filter((position) =>
      named.has(position),
    ),
  );
};

// Consecutive positions as ranges. A doubled letter is marked whole, since
// learning one half of it is learning the wrong thing.
const markedRanges = (
  word: string,
  marked: ReadonlySet<number>,
): ReadonlyArray<readonly [number, number]> => {
  const ranges: Array<readonly [number, number]> = [];
  for (const position of [...marked].sort((left, right) => left - right)) {
    const previous = ranges.at(-1);
    if (previous?.[1] === position) {
      ranges[ranges.length - 1] = [previous[0], position + 1];
    } else {
      ranges.push([position, position + 1]);
    }
  }
  return ranges.map(([start, end]) => {
    const letter = word[start];
    if (word.slice(start, end) !== letter?.repeat(end - start)) {
      return [start, end] as const;
    }
    let from = start;
    let to = end;
    while (word[from - 1] === letter) {
      from -= 1;
    }
    while (word[to] === letter) {
      to += 1;
    }
    return [from, to] as const;
  });
};

// Only the marked word of a phrase is shown.
const spellingSegments = (
  suggestion: PitfallSuggestion,
): ReadonlyArray<SpellingSegment> | undefined => {
  const { word } = suggestion;
  const ranges = markedRanges(word, markedPositions(suggestion));
  const first = ranges.at(0);
  const last = ranges.at(-1);
  if (first === undefined || last === undefined) {
    return undefined;
  }
  const [markStart] = first;
  const [, markEnd] = last;
  let plainFrom = word.slice(0, markStart).search(wordTail);
  const segments: Array<SpellingSegment> = [];
  for (const [start, end] of ranges) {
    segments.push(
      { text: word.slice(plainFrom, start), tricky: false },
      { text: word.slice(start, end), tricky: true },
    );
    plainFrom = end;
  }
  segments.push({
    text: word.slice(markEnd, markEnd + word.slice(markEnd).search(wordHead)),
    tricky: false,
  });
  return segments.filter((segment) => segment.text !== '');
};

// A pitfall with an empty field, in a word the item does not contain, one
// the misspelling does not back, or a note that repeats the wrong form is
// dropped: the item is still usable without it, and the learner should never
// read the wrong form.
export const readPitfalls = (
  targetText: string,
  suggestions: ReadonlyArray<PitfallSuggestion>,
): ReadonlyArray<SpellingPitfall> =>
  suggestions.flatMap((suggestion) => {
    if (
      suggestion.word === '' ||
      suggestion.misspelling === '' ||
      suggestion.note === '' ||
      suggestion.word === suggestion.misspelling ||
      !wordPattern(suggestion.word, 'u').test(targetText) ||
      wordPattern(suggestion.misspelling, 'iu').test(suggestion.note)
    ) {
      return [];
    }
    const segments = spellingSegments(suggestion);
    return segments === undefined ? [] : [{ segments, note: suggestion.note }];
  });
