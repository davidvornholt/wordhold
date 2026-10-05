import { bibleBookCount } from '../schemas/bible-books';

// A verse as a MySword module stores it: numbered in the module's
// versification, with the module's markup.
export type ModuleVerse = {
  readonly book: number;
  readonly chapter: number;
  readonly verse: number;
  readonly scripture: string;
};

// A verse numbered the way the translation itself numbers it, as plain text
// with one line per line of poetry.
export type BibleVerse = {
  readonly book: number;
  readonly chapter: number;
  readonly verse: number;
  readonly text: string;
};

type Position = {
  readonly chapter: number;
  readonly verse: number;
};

const psalms = 19;

// Notes beside the text: footnotes, headings, cross references, Strong's
// numbers, morphology, interlinear blocks and superscript note markers.
const notes = [
  /<RF[^>]*>.*?<Rf>/gsu,
  /<TS\d?>.*?<Ts>/gsu,
  /<Q>.*?<q>/gsu,
  /<sup>.*?<\/sup>/gisu,
  /<(?:RX|WG|WH|WT)[^>]*>/gu,
];

// Modules that follow the English versification name the translation's own
// verse in parentheses where the two differ: "(3)" for verse 3 of the
// current chapter, "(3,19)" for chapter 3, verse 19, and "(63,19b)" for the
// second half of a verse.
const verseMarker = /\((?<first>\d{1,3})(?:,(?<second>\d{1,3}))?[ab]?\)/gu;

// A Psalm's superscription in italics, before the first words of its first
// verse.
const superscription = /^\s*<i>.*?<\/i>(?<rest>.*)$/su;

const wordCharacter = /[\p{L}\p{N}]/u;

const withoutTags = (text: string) => text.replace(/<[^>]*>/gu, '');

const hasWords = (text: string) => wordCharacter.test(withoutTags(text));

const isAfter = (a: Position, b: Position) =>
  a.chapter > b.chapter || (a.chapter === b.chapter && a.verse > b.verse);

const removeNotes = (scripture: string) =>
  notes.reduce((text, note) => text.replace(note, ''), scripture);

const namedCharacters = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', ' '],
  ['auml', 'ä'],
  ['Auml', 'Ä'],
  ['ouml', 'ö'],
  ['Ouml', 'Ö'],
  ['uuml', 'ü'],
  ['Uuml', 'Ü'],
  ['szlig', 'ß'],
]);

// Decode once, after removing markup, so escaped literal tags stay text.
// Unknown references and invalid Unicode scalars remain as written.
const maximumCodePoint = 0x10_ff_ff;
const firstSurrogate = 0xd8_00;
const lastSurrogate = 0xdf_ff;

const decodeCharacters = (text: string) =>
  text.replace(
    /&(?<name>#x[\da-f]+|#\d+|[a-z]+);/giu,
    (reference, name: string) => {
      if (!name.startsWith('#')) {
        return namedCharacters.get(name) ?? reference;
      }
      const hexadecimal = name[1]?.toLowerCase() === 'x';
      const code = Number(hexadecimal ? `0${name.slice(1)}` : name.slice(1));
      return code > 0 &&
        code <= maximumCodePoint &&
        !(code >= firstSurrogate && code <= lastSurrogate)
        ? String.fromCodePoint(code)
        : reference;
    },
  );

// Paragraph marks become spaces and line breaks lines. A slash before a
// space or at the end separates the lines of poetry, while one between
// digits is part of a fraction. Brackets around words the translator added
// and the musical note for "Sela" are not read aloud, so they are left out.
const plainText = (text: string) =>
  decodeCharacters(
    text
      .replace(/<C[MI]>/gu, ' ')
      .replace(/<CL>|<br\s*\/?\s*>/giu, '\n')
      .replace(/<[^>]*>/gu, ''),
  )
    .replace(/\s*\/(?:\s+|$)/gu, '\n')
    .replace(/[‹›♪]/gu, '')
    .split('\n')
    .map((line) => line.replace(/\s+/gu, ' ').trim())
    .filter((line) => line !== '')
    .join('\n');

// A superscription that shares the first verse with the Psalm's opening
// words is not learned with them, so "Psalm 23,1" starts with "Der HERR
// ist mein Hirte". A superscription that is a verse of its own stays.
const withoutSuperscription = (book: number, verse: number, text: string) => {
  if (book !== psalms || verse !== 1) {
    return text;
  }
  const rest = superscription.exec(text)?.groups?.rest;
  return rest !== undefined && hasWords(rest) ? rest : text;
};

// A bare verse number belongs to the chapter of the verse before it, except
// that "(1)" after a later verse starts the next chapter.
const bareMarkedPosition = (verse: number, before: Position): Position =>
  verse === 1 && before.verse > 1
    ? { chapter: before.chapter + 1, verse: 1 }
    : { chapter: before.chapter, verse };

// Where text after a marker belongs, counted from the verse the text before
// it belongs to. A marker that would lead back before that verse is not a
// marker but part of the text.
const markedPosition = (
  marker: RegExpMatchArray,
  before: Position,
): Position | null => {
  const first = Number(marker.groups?.first);
  const second = marker.groups?.second;
  const target =
    second === undefined
      ? bareMarkedPosition(first, before)
      : { chapter: first, verse: Number(second) };
  return isAfter(before, target) ? null : target;
};

type BookText = Map<string, { position: Position; text: string }>;

const appendTo = (verses: BookText, position: Position, text: string) => {
  const key = `${position.chapter}:${position.verse}`;
  const stored = verses.get(key);
  verses.set(key, {
    position,
    text: stored === undefined ? text : `${stored.text} ${text}`,
  });
};

// Files one row's text under the verses its markers name. Text before the
// first marker belongs to the module's verse, unless the translation is
// still behind the module there: then it continues the translation's
// current verse. Returns the verse the translation is at afterwards.
const fileRow = (
  verses: BookText,
  row: ModuleVerse,
  scripture: string,
  start: Position,
): Position => {
  let current = start;
  const own = { chapter: row.chapter, verse: row.verse };
  let position = isAfter(own, current) ? own : current;
  let segment = '';
  let end = 0;
  const fileSegment = () => {
    if (hasWords(segment)) {
      appendTo(verses, position, segment);
      current = position;
    }
  };
  for (const marker of scripture.matchAll(verseMarker)) {
    segment += scripture.slice(end, marker.index);
    end = marker.index + marker[0].length;
    const before = hasWords(segment) ? position : current;
    const target = markedPosition(
      marker,
      before.chapter === 0 ? { chapter: row.chapter, verse: 0 } : before,
    );
    if (target === null) {
      segment += marker[0];
    } else {
      fileSegment();
      position = target;
      segment = '';
    }
  }
  segment += scripture.slice(end);
  fileSegment();
  return current;
};

// One book's verses, renumbered by the markers, in order and as plain text.
const bookVerses = (
  book: number,
  rows: ReadonlyArray<ModuleVerse>,
): Array<BibleVerse> => {
  const verses: BookText = new Map();
  let current: Position = { chapter: 0, verse: 0 };
  for (const row of rows) {
    const scripture = removeNotes(row.scripture);
    if (hasWords(scripture)) {
      current = fileRow(verses, row, scripture, current);
    }
  }
  return [...verses.values()]
    .toSorted(
      (a, b) =>
        a.position.chapter - b.position.chapter ||
        a.position.verse - b.position.verse,
    )
    .flatMap(({ position, text }) => {
      const plain = plainText(
        withoutSuperscription(book, position.verse, text),
      );
      return plain === ''
        ? []
        : [
            {
              book,
              chapter: position.chapter,
              verse: position.verse,
              text: plain,
            },
          ];
    });
};

// The verses of a module as the translation numbers them, as plain text.
// Books beyond Revelation, such as the Apocrypha, are left out, as are
// verses the translation leaves empty.
export const moduleVerses = (
  rows: ReadonlyArray<ModuleVerse>,
): Array<BibleVerse> => {
  const byBook = new Map<number, Array<ModuleVerse>>();
  const bibleRows = rows.filter(
    ({ book }) => book >= 1 && book <= bibleBookCount,
  );
  for (const row of bibleRows) {
    const bookRows = byBook.get(row.book) ?? [];
    bookRows.push(row);
    byBook.set(row.book, bookRows);
  }
  return [...byBook.entries()]
    .toSorted(([a], [b]) => a - b)
    .flatMap(([book, bookRows]) =>
      bookVerses(
        book,
        bookRows.toSorted((a, b) => a.chapter - b.chapter || a.verse - b.verse),
      ),
    );
};
