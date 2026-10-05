import { describe, expect, it } from 'bun:test';
import {
  bibleBookCount,
  bibleBooks,
  bookKey,
  bookName,
  findBook,
} from './bible-books';

describe('bibleBooks', () => {
  it('lists the 66 books from Genesis to Revelation', () => {
    expect(bibleBookCount).toBe(66);
    expect(bookName(1)).toBe('1. Mose');
    expect(bookName(19)).toBe('Psalm');
    expect(bookName(66)).toBe('Offenbarung');
  });

  it('gives every name and abbreviation to one book only', () => {
    const keys = bibleBooks.flatMap((book) =>
      [book.name, ...book.aliases].map(bookKey),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('findBook', () => {
  it('finds a book by its name or abbreviation, however it is written', () => {
    expect(findBook('Johannes')).toEqual({ kind: 'found', book: 43 });
    expect(findBook('joh')).toEqual({ kind: 'found', book: 43 });
    expect(findBook('1. Joh')).toEqual({ kind: 'found', book: 62 });
    expect(findBook('1Joh')).toEqual({ kind: 'found', book: 62 });
    expect(findBook('1 Koen')).toEqual({ kind: 'found', book: 11 });
    expect(findBook('Römer')).toEqual({ kind: 'found', book: 45 });
    expect(findBook('Roemer')).toEqual({ kind: 'found', book: 45 });
  });

  it('finds a book by the start of its name when only one book starts so', () => {
    expect(findBook('Phile')).toEqual({ kind: 'found', book: 57 });
    expect(findBook('Offen')).toEqual({ kind: 'found', book: 66 });
  });

  it('names the books a start fits when it fits several', () => {
    expect(findBook('Ma')).toEqual({
      kind: 'ambiguous',
      names: ['Maleachi', 'Matthäus', 'Markus'],
    });
  });

  it('knows no book by a name no book has', () => {
    expect(findBook('Henoch')).toEqual({ kind: 'unknown' });
    expect(findBook(' . ')).toEqual({ kind: 'unknown' });
  });
});
