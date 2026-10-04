import { bookName, findBook } from './bible-books';

// A passage within one chapter: a whole chapter, one verse, or a run of
// verses.
export type BibleReference = {
  readonly book: number;
  readonly chapter: number;
  readonly verses: {
    readonly first: number;
    readonly last: number;
  } | null;
};

export type ParsedReference =
  | { readonly kind: 'parsed'; readonly reference: BibleReference }
  | { readonly kind: 'invalid'; readonly message: string };

// A book, optionally numbered ("1. Kor", "1Kor"), then a chapter, then
// optionally a verse with a comma or colon: "Joh 3", "Joh 3,16",
// "Joh 3:16-18", "Ps 23,1–3", "Röm 8,28f".
const referencePattern =
  /^(?<book>(?:[1-3]\.?\s*)?\p{L}[\p{L}\s.]*?)\s*(?<chapter>\d{1,3})(?:\s*[,:]\s*(?<first>\d{1,3})(?:\s*(?:[-–—]\s*(?<last>\d{1,3})|(?<next>f)))?)?\s*$/u;

const invalid = (message: string): ParsedReference => ({
  kind: 'invalid',
  message,
});

export const parseBibleReference = (typed: string): ParsedReference => {
  const groups = referencePattern.exec(typed.trim())?.groups;
  if (groups?.book === undefined || groups.chapter === undefined) {
    return invalid(
      `„${typed.trim()}“ ist keine Bibelstelle. Schreib sie zum Beispiel als „Joh 3,16“ oder „Ps 23,1-3“.`,
    );
  }
  const match = findBook(groups.book);
  if (match.kind === 'unknown') {
    return invalid(`Ein Buch „${groups.book.trim()}“ kennt Wordhold nicht.`);
  }
  if (match.kind === 'ambiguous') {
    return invalid(
      `„${groups.book.trim()}“ passt zu mehreren Büchern: ${match.names.join(', ')}. Schreib mehr vom Namen.`,
    );
  }
  const chapter = Number(groups.chapter);
  const first = groups.first === undefined ? null : Number(groups.first);
  if (chapter === 0 || first === 0) {
    return invalid('Kapitel und Verse beginnen bei 1.');
  }
  if (first === null) {
    return {
      kind: 'parsed',
      reference: { book: match.book, chapter, verses: null },
    };
  }
  const last =
    groups.next === undefined ? Number(groups.last ?? first) : first + 1;
  if (last < first) {
    return invalid(
      `Der letzte Vers muss nach dem ersten kommen, also zum Beispiel ${first}-${first + 1}.`,
    );
  }
  return {
    kind: 'parsed',
    reference: { book: match.book, chapter, verses: { first, last } },
  };
};

// The reference as a title, the way German Bibles write it: "Johannes 3,16",
// "Psalm 23,1–3" or "Psalm 23".
export const formatBibleReference = ({
  book,
  chapter,
  verses,
}: BibleReference): string => {
  const place = `${bookName(book)} ${chapter}`;
  if (verses === null) {
    return place;
  }
  return verses.last === verses.first
    ? `${place},${verses.first}`
    : `${place},${verses.first}–${verses.last}`;
};
