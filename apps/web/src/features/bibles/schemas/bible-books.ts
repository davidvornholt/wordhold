// The 66 books in the Protestant order, which is how MySword modules number
// them (1 is Genesis, 66 is Revelation). Each book has the German name a
// reference is written with and the abbreviations people commonly type,
// following the Loccum guidelines and Luther's names.
export const bibleBooks = [
  { name: '1. Mose', aliases: ['1Mo', '1Mos', 'Gen', 'Genesis'] },
  { name: '2. Mose', aliases: ['2Mo', '2Mos', 'Ex', 'Exodus'] },
  { name: '3. Mose', aliases: ['3Mo', '3Mos', 'Lev', 'Levitikus'] },
  { name: '4. Mose', aliases: ['4Mo', '4Mos', 'Num', 'Numeri'] },
  { name: '5. Mose', aliases: ['5Mo', '5Mos', 'Dtn', 'Deuteronomium'] },
  { name: 'Josua', aliases: ['Jos'] },
  { name: 'Richter', aliases: ['Ri'] },
  { name: 'Rut', aliases: ['Rt', 'Ruth'] },
  { name: '1. Samuel', aliases: ['1Sam', '1Sa'] },
  { name: '2. Samuel', aliases: ['2Sam', '2Sa'] },
  { name: '1. Könige', aliases: ['1Kön', '1Kö', '1Kg'] },
  { name: '2. Könige', aliases: ['2Kön', '2Kö', '2Kg'] },
  { name: '1. Chronik', aliases: ['1Chr'] },
  { name: '2. Chronik', aliases: ['2Chr'] },
  { name: 'Esra', aliases: ['Esr'] },
  { name: 'Nehemia', aliases: ['Neh'] },
  { name: 'Ester', aliases: ['Est', 'Esther'] },
  { name: 'Hiob', aliases: ['Hi', 'Ijob', 'Job'] },
  { name: 'Psalm', aliases: ['Ps', 'Psalmen', 'Psalter'] },
  { name: 'Sprüche', aliases: ['Spr', 'Sprichwörter'] },
  { name: 'Prediger', aliases: ['Pred', 'Koh', 'Kohelet'] },
  { name: 'Hohelied', aliases: ['Hld', 'Hoheslied'] },
  { name: 'Jesaja', aliases: ['Jes'] },
  { name: 'Jeremia', aliases: ['Jer'] },
  { name: 'Klagelieder', aliases: ['Klgl', 'Kla'] },
  { name: 'Hesekiel', aliases: ['Hes', 'Ez', 'Ezechiel'] },
  { name: 'Daniel', aliases: ['Dan', 'Da'] },
  { name: 'Hosea', aliases: ['Hos'] },
  { name: 'Joel', aliases: [] },
  { name: 'Amos', aliases: ['Am'] },
  { name: 'Obadja', aliases: ['Obd', 'Ob'] },
  { name: 'Jona', aliases: ['Jon'] },
  { name: 'Micha', aliases: ['Mi'] },
  { name: 'Nahum', aliases: ['Nah'] },
  { name: 'Habakuk', aliases: ['Hab'] },
  { name: 'Zefanja', aliases: ['Zef', 'Zeph', 'Zephanja'] },
  { name: 'Haggai', aliases: ['Hag'] },
  { name: 'Sacharja', aliases: ['Sach'] },
  { name: 'Maleachi', aliases: ['Mal'] },
  { name: 'Matthäus', aliases: ['Mt', 'Mat', 'Matth'] },
  { name: 'Markus', aliases: ['Mk', 'Mar', 'Mark'] },
  { name: 'Lukas', aliases: ['Lk', 'Luk'] },
  { name: 'Johannes', aliases: ['Joh', 'Jh'] },
  { name: 'Apostelgeschichte', aliases: ['Apg'] },
  { name: 'Römer', aliases: ['Röm', 'Rö'] },
  { name: '1. Korinther', aliases: ['1Kor', '1Ko'] },
  { name: '2. Korinther', aliases: ['2Kor', '2Ko'] },
  { name: 'Galater', aliases: ['Gal'] },
  { name: 'Epheser', aliases: ['Eph'] },
  { name: 'Philipper', aliases: ['Phil', 'Php'] },
  { name: 'Kolosser', aliases: ['Kol'] },
  { name: '1. Thessalonicher', aliases: ['1Thess', '1Th'] },
  { name: '2. Thessalonicher', aliases: ['2Thess', '2Th'] },
  { name: '1. Timotheus', aliases: ['1Tim', '1Ti'] },
  { name: '2. Timotheus', aliases: ['2Tim', '2Ti'] },
  { name: 'Titus', aliases: ['Tit'] },
  { name: 'Philemon', aliases: ['Phlm', 'Phm'] },
  { name: 'Hebräer', aliases: ['Hebr', 'Heb'] },
  { name: 'Jakobus', aliases: ['Jak'] },
  { name: '1. Petrus', aliases: ['1Petr', '1Pt', '1Pe'] },
  { name: '2. Petrus', aliases: ['2Petr', '2Pt', '2Pe'] },
  { name: '1. Johannes', aliases: ['1Joh'] },
  { name: '2. Johannes', aliases: ['2Joh'] },
  { name: '3. Johannes', aliases: ['3Joh'] },
  { name: 'Judas', aliases: ['Jud'] },
  { name: 'Offenbarung', aliases: ['Offb', 'Off', 'Apk'] },
] as const satisfies ReadonlyArray<{
  readonly name: string;
  readonly aliases: ReadonlyArray<string>;
}>;

export const bibleBookCount = bibleBooks.length;

// The name of a book by its number, which starts at 1.
export const bookName = (book: number): string =>
  bibleBooks[book - 1]?.name ?? `Buch ${book}`;

const umlauts = new Map([
  ['ä', 'ae'],
  ['ö', 'oe'],
  ['ü', 'ue'],
  ['ß', 'ss'],
]);

// How a typed book name is compared: without case, spaces and dots, and
// with umlauts spelled out, so "1. Kön", "1kön" and "1 Koen" are the same.
export const bookKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[äöüß]/gu, (letter) => umlauts.get(letter) ?? letter)
    .replace(/[\s.]/gu, '');

const keyedBooks = bibleBooks.map((book, index) => ({
  number: index + 1,
  name: book.name,
  keys: [book.name, ...book.aliases].map(bookKey),
}));

export type BookMatch =
  | { readonly kind: 'found'; readonly book: number }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'ambiguous'; readonly names: ReadonlyArray<string> };

// A name or abbreviation listed above names its book. Otherwise the start of
// a name does, as long as only one book starts that way: "Phile" is
// Philemon, while "Ma" could be Matthäus, Markus or Maleachi.
export const findBook = (typed: string): BookMatch => {
  const key = bookKey(typed);
  if (key === '') {
    return { kind: 'unknown' };
  }
  const exact = keyedBooks.find((book) => book.keys.includes(key));
  if (exact !== undefined) {
    return { kind: 'found', book: exact.number };
  }
  const started = keyedBooks.filter((book) =>
    book.keys.some((candidate) => candidate.startsWith(key)),
  );
  const [only] = started;
  if (only === undefined) {
    return { kind: 'unknown' };
  }
  return started.length === 1
    ? { kind: 'found', book: only.number }
    : { kind: 'ambiguous', names: started.map((book) => book.name) };
};
