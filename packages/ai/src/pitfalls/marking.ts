import type {
  PitfallSuggestion,
  SpellingPitfall,
  SpellingSegment,
} from './schema';

// The model names the letters to learn and a typical misspelling. A named
// group is marked only where the misspelling gets it wrong: the model cannot
// count letters reliably, and a mark it cannot back with a mistake points
// the learner to the wrong place.
const escapedPattern = /[.*+?^${}()|[\]\\]/gu;
// Letter pairs such as ou, ch or ss are learned as one unit. A longer group
// is mostly a pair with its neighbours or a whole word, so only the letters
// of it that the misspelling gets wrong are marked.
const maximumUnitLength = 2;

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

const letterRuns = /[\p{L}\p{M}]+/gu;

// How many letters the misspelling changes in a part of the word.
const difference = (part: string, misspelling: string) => {
  const { missing, added } = align(part, misspelling);
  return [...added.values()].reduce(
    (count, letters) => count + letters.length,
    missing.length,
  );
};

// Where in `word` the misspelling lies. The model sometimes names a whole
// phrase as the word but misspells one word of it, and lining the phrase up
// with that one word would mark letters of the others. Of the runs of as
// many words as the misspelling has, it lies in the one it differs from
// least.
const misspelledSpan = (
  word: string,
  misspelling: string,
): readonly [number, number] => {
  const spans = [...word.matchAll(letterRuns)].map(
    (run) => [run.index, run.index + run[0].length] as const,
  );
  const count = misspelling.match(letterRuns)?.length ?? 0;
  if (count === 0 || count >= spans.length) {
    return [0, word.length];
  }
  let best: readonly [number, number] = [0, word.length];
  let fewest = Number.POSITIVE_INFINITY;
  for (const [index, [start]] of spans
    .slice(0, spans.length - count + 1)
    .entries()) {
    const end = spans[index + count - 1]?.[1] ?? start;
    const changes = difference(word.slice(start, end), misspelling);
    if (changes < fewest) {
      best = [start, end];
      fewest = changes;
    }
  }
  return best;
};

// The positions in `word` to mark: each named unit the misspelling gets
// wrong, whole, and the wrong letters of a longer named group. A named group
// the misspelling leaves alone stays unmarked.
const markedPositions = ({
  word,
  letters,
  misspelling,
}: PitfallSuggestion): ReadonlySet<number> => {
  const [start, end] = misspelledSpan(word, misspelling);
  const changed = new Set(
    changedPositions(word.slice(start, end), misspelling).map(
      (position) => start + position,
    ),
  );
  const marked = new Set<number>();
  // An empty group would match everywhere and never advance.
  for (const group of letters.filter((letter) => letter !== '')) {
    for (
      let at = word.indexOf(group);
      at !== -1;
      at = word.indexOf(group, at + 1)
    ) {
      const positions = positionsBetween(at, at + group.length);
      const wrong = positions.filter((position) => changed.has(position));
      const unit = wrong.length > 0 && group.length <= maximumUnitLength;
      for (const position of unit ? positions : wrong) {
        marked.add(position);
      }
    }
  }
  return marked;
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

// A note places the letters by their neighbours, as in "nach dem t" or "vor
// dem qu", and the model often names the wrong neighbour.
const neighbourClaim =
  /(?<!\p{L})(?<side>nach|vor) dem (?<named>\p{L}{1,3})(?![\p{L}-])/giu;

// Letters without accents or case, one for each letter of `text`.
const baseLetters = (text: string) =>
  text
    .split('')
    .map((letter) =>
      letter.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(),
    )
    .join('');

// Whether every neighbour the note names borders a mark or is its first or
// last letters, as in "nach dem t steht kein h" for a marked t. A name the
// word does not contain, such as "dem Ton", is not about its letters.
const neighboursHold = (
  word: string,
  ranges: ReadonlyArray<readonly [number, number]>,
  note: string,
): boolean => {
  const letters = baseLetters(word);
  if (letters.length !== word.length) {
    return true;
  }
  return [...note.matchAll(neighbourClaim)].every(({ groups = {} }) => {
    const { side = '', named = '' } = groups;
    const neighbour = baseLetters(named);
    if (!letters.includes(neighbour)) {
      return true;
    }
    return ranges.some(([start, end]) =>
      positionsBetween(start, end + 1).some((boundary) =>
        side.toLowerCase() === 'nach'
          ? boundary >= neighbour.length &&
            letters.slice(boundary - neighbour.length, boundary) === neighbour
          : letters.startsWith(neighbour, boundary),
      ),
    );
  });
};

// The whole item, with the marks in the first place it has the word. The
// model sometimes lowercases a word the item capitalizes, as in Dirección.
const spellingSegments = (
  targetText: string,
  suggestion: PitfallSuggestion,
): ReadonlyArray<SpellingSegment> | undefined => {
  const found = wordPattern(suggestion.word, 'iu').exec(targetText);
  const ranges = markedRanges(suggestion.word, markedPositions(suggestion));
  if (
    found === null ||
    ranges.length === 0 ||
    !neighboursHold(suggestion.word, ranges, suggestion.note)
  ) {
    return undefined;
  }
  const segments: Array<SpellingSegment> = [];
  let plainFrom = 0;
  for (const [start, end] of ranges) {
    const markFrom = found.index + start;
    const markTo = found.index + end;
    segments.push(
      { text: targetText.slice(plainFrom, markFrom), tricky: false },
      { text: targetText.slice(markFrom, markTo), tricky: true },
    );
    plainFrom = markTo;
  }
  segments.push({ text: targetText.slice(plainFrom), tricky: false });
  return segments.filter((segment) => segment.text !== '');
};

// A note ends like a sentence, not with an ellipsis or mid-sentence.
const completeNote = /(?<![.…])[.!?]$/u;

// A pitfall with an empty field, in a word the item does not contain, or one
// the misspelling does not back is dropped, and so is a note that repeats the
// wrong form or is cut off: the item is still usable without it, and the
// learner should never read the wrong form or half a rule.
export const readPitfalls = (
  targetText: string,
  suggestions: ReadonlyArray<PitfallSuggestion>,
): ReadonlyArray<SpellingPitfall> =>
  suggestions.flatMap((suggestion) => {
    if (
      suggestion.word === '' ||
      suggestion.misspelling === '' ||
      suggestion.word === suggestion.misspelling ||
      !completeNote.test(suggestion.note) ||
      wordPattern(suggestion.misspelling, 'iu').test(suggestion.note)
    ) {
      return [];
    }
    const segments = spellingSegments(targetText, suggestion);
    return segments === undefined ? [] : [{ segments, note: suggestion.note }];
  });
