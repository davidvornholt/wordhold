import { describe, expect, it } from 'bun:test';
import type { CourseUnit } from '../schemas/course-units';
import {
  bookSummary,
  initiallyOpenBooks,
  unitPracticeStatus,
  unitProgressSummary,
} from './unit-status';

const vocabularyCount = 12;

const unit = (overrides: Partial<CourseUnit>): CourseUnit => ({
  bookId: '00000000-0000-0000-0000-000000000009',
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Unit 1',
  entries: 10,
  introduced: 10,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  directions: [],
  ...overrides,
});

describe('unitPracticeStatus', () => {
  it('reports due reviews first, with singular grammar', () => {
    expect(unitPracticeStatus(unit({ due: 1, firstReviews: 3 }))).toBe(
      '1 Wiederholung offen',
    );
  });

  it('reports first reviews when nothing is due', () => {
    expect(unitPracticeStatus(unit({ firstReviews: 2 }))).toBe(
      '2 Karten zum ersten Mal üben',
    );
  });

  it('reports rest when nothing is scheduled', () => {
    expect(unitPracticeStatus(unit({}))).toBe('Für jetzt geschafft');
  });

  it('names the next date when work is only scheduled later', () => {
    expect(
      unitPracticeStatus(unit({ nextDueAt: new Date('2099-01-01') })),
    ).toStartWith('Nächster Termin');
  });
});

describe('unitProgressSummary', () => {
  it('reports an empty unit without practice status', () => {
    expect(unitProgressSummary(unit({ entries: 0, introduced: 0 }))).toBe(
      'Noch keine Vokabeln',
    );
  });

  it('names what is left to learn and to review', () => {
    expect(
      unitProgressSummary(
        unit({
          entries: vocabularyCount,
          introduced: vocabularyCount,
          unintroduced: 3,
          due: 2,
        }),
      ),
    ).toBe('12 Vokabeln · 3 noch kennenlernen · 2 Wiederholungen offen');
  });

  it('does not call an untouched unit finished', () => {
    expect(
      unitProgressSummary(
        unit({
          entries: vocabularyCount,
          introduced: 0,
          unintroduced: vocabularyCount,
        }),
      ),
    ).toBe('12 Vokabeln · 12 noch kennenlernen');
  });

  it('summarizes a fully introduced unit', () => {
    expect(unitProgressSummary(unit({ entries: 1, introduced: 1 }))).toBe(
      '1 Vokabel · Für jetzt geschafft',
    );
  });
});

describe('bookSummary', () => {
  it('counts the units of a book and the words they hold', () => {
    expect(
      bookSummary([unit({ entries: 10 }), unit({ entries: vocabularyCount })]),
    ).toBe('2 Einheiten · 22 Vokabeln');
    expect(bookSummary([])).toBe('0 Einheiten · 0 Vokabeln');
  });
});

describe('initiallyOpenBooks', () => {
  const book = (id: string) => ({ id, name: `Buch ${id}` });
  const finished = unit({});
  const unlearned = unit({ unintroduced: 2 });

  it('opens books with work left or without units, wherever they are listed', () => {
    expect(
      initiallyOpenBooks([
        { book: book('2'), units: [unlearned] },
        { book: book('3'), units: [unit({ due: 1 })] },
        { book: book('1'), units: [finished] },
        { book: book('4'), units: [] },
      ]),
    ).toEqual(new Set(['2', '3', '4']));
  });

  it('keeps the last book open once every book is finished', () => {
    expect(
      initiallyOpenBooks([
        { book: book('1'), units: [finished] },
        { book: book('2'), units: [finished] },
      ]),
    ).toEqual(new Set(['2']));
  });
});
