import { describe, expect, it } from 'bun:test';
import type { Book, Unit } from '../services/repository';
import {
  bookChanged,
  initialBookSelection,
  unitsInBook,
} from './initial-book-selection';

const secondBook: Book = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Encuentros hoy 2',
  lastImportedAt: new Date('2026-09-20T10:00:00Z'),
};
const thirdBook: Book = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Encuentros hoy 3',
  lastImportedAt: new Date('2026-09-10T10:00:00Z'),
};
const emptyBook: Book = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Encuentros hoy 4',
  lastImportedAt: null,
};

describe('initialBookSelection', () => {
  it('picks the book that received words most recently', () => {
    expect(initialBookSelection([secondBook, thirdBook, emptyBook])).toEqual({
      kind: 'existing',
      bookId: secondBook.id,
    });
  });

  it('falls back to the last book while every book is empty', () => {
    expect(
      initialBookSelection([
        { ...secondBook, lastImportedAt: null },
        emptyBook,
      ]),
    ).toEqual({ kind: 'existing', bookId: emptyBook.id });
  });

  it('asks for a name when the course has no book yet', () => {
    expect(initialBookSelection([])).toEqual({ kind: 'new', name: '' });
  });
});

describe('unitsInBook', () => {
  const unit = (id: string, bookId: string, name: string): Unit => ({
    id,
    bookId,
    name,
    position: 0,
    isHolding: false,
    entryCount: 0,
  });
  const units = [
    unit('44444444-4444-4444-8444-444444444444', secondBook.id, 'U1 Acércate'),
    unit('55555555-5555-4555-8555-555555555555', thirdBook.id, 'U1 Acércate'),
  ];

  it('offers only the units of the selected book', () => {
    expect(
      unitsInBook(units, { kind: 'existing', bookId: thirdBook.id }),
    ).toEqual([units[1]]);
    expect(
      unitsInBook(units, { kind: 'new', name: 'Encuentros hoy 5' }),
    ).toEqual([]);
  });
});

describe('bookChanged', () => {
  it('ignores typing in a new book name', () => {
    expect(
      bookChanged({ kind: 'new', name: 'E' }, { kind: 'new', name: 'En' }),
    ).toBe(false);
    expect(
      bookChanged(
        { kind: 'existing', bookId: secondBook.id },
        { kind: 'existing', bookId: thirdBook.id },
      ),
    ).toBe(true);
    expect(
      bookChanged(
        { kind: 'existing', bookId: secondBook.id },
        { kind: 'new', name: '' },
      ),
    ).toBe(true);
  });
});
