import { describe, expect, it } from 'bun:test';
import { bibleBooks } from './bible-books';
import {
  type BibleReference,
  formatBibleReference,
  parseBibleReference,
} from './bible-reference';

const parsed = (typed: string): BibleReference | string => {
  const result = parseBibleReference(typed);
  return result.kind === 'parsed' ? result.reference : result.message;
};

describe('parseBibleReference', () => {
  it('accepts every supported book name and alias', () => {
    for (const [index, book] of bibleBooks.entries()) {
      for (const name of [book.name, ...book.aliases]) {
        expect(parsed(`${name} 1,1`)).toEqual({
          book: index + 1,
          chapter: 1,
          verses: { first: 1, last: 1 },
        });
      }
    }
  });

  it('reads a verse, a run of verses and a whole chapter', () => {
    expect(parsed('Joh 3,16')).toEqual({
      book: 43,
      chapter: 3,
      verses: { first: 16, last: 16 },
    });
    expect(parsed('Ps 23,1-3')).toEqual({
      book: 19,
      chapter: 23,
      verses: { first: 1, last: 3 },
    });
    expect(parsed('Psalm 23')).toEqual({
      book: 19,
      chapter: 23,
      verses: null,
    });
  });

  it('accepts the ways references are commonly written', () => {
    const verses = { first: 4, last: 7 };
    for (const typed of [
      '1. Kor 13,4-7',
      '1Kor 13,4–7',
      '1 Korinther 13:4 - 7',
      '  1.kor13,4-7  ',
    ]) {
      expect(parsed(typed)).toEqual({ book: 46, chapter: 13, verses });
    }
    expect(parsed('Röm 8,28f')).toEqual({
      book: 45,
      chapter: 8,
      verses: { first: 28, last: 29 },
    });
  });

  it('explains what is wrong with a reference it cannot read', () => {
    expect(parsed('Johannes')).toBe(
      '„Johannes“ ist keine Bibelstelle. Schreib sie zum Beispiel als „Joh 3,16“ oder „Ps 23,1-3“.',
    );
    expect(parsed('Henoch 1,9')).toBe(
      'Ein Buch „Henoch“ kennt Wordhold nicht.',
    );
    expect(parsed('Ma 1,1')).toBe(
      '„Ma“ passt zu mehreren Büchern: Maleachi, Matthäus, Markus. Schreib mehr vom Namen.',
    );
    expect(parsed('Ps 0')).toBe('Kapitel und Verse beginnen bei 1.');
    expect(parsed('Ps 23,0')).toBe('Kapitel und Verse beginnen bei 1.');
    expect(parsed('Ps 23,3-1')).toBe(
      'Der letzte Vers muss nach dem ersten kommen, also zum Beispiel 3-4.',
    );
  });
});

describe('formatBibleReference', () => {
  it('writes the reference the way German Bibles do', () => {
    expect(
      formatBibleReference({
        book: 43,
        chapter: 3,
        verses: { first: 16, last: 16 },
      }),
    ).toBe('Johannes 3,16');
    expect(
      formatBibleReference({
        book: 19,
        chapter: 23,
        verses: { first: 1, last: 3 },
      }),
    ).toBe('Psalm 23,1–3');
    expect(formatBibleReference({ book: 1, chapter: 1, verses: null })).toBe(
      '1. Mose 1',
    );
  });
});
