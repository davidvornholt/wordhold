import { describe, expect, it } from 'bun:test';
import { courseNouns } from '../../../shared/directions';
import type { CourseBook, CourseUnit } from '../schemas/course-units';
import {
  bookSummary,
  practiceStatus,
  progressSummary,
} from './progress-status';

const vocabularyCount = 12;

const vocabulary = courseNouns({ kind: 'language', targetLanguage: 'en' });
const terms = courseNouns({ kind: 'terms', targetLanguage: 'de' });

const progress = {
  entries: 10,
  introduced: 10,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  lastAddedAt: null,
  directions: [],
} as const;

const unit = (overrides: Partial<CourseUnit>): CourseUnit => ({
  bookId: '00000000-0000-0000-0000-000000000009',
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Unit 1',
  ...progress,
  ...overrides,
});

const book = (overrides: Partial<CourseBook>): CourseBook => ({
  id: '00000000-0000-0000-0000-000000000009',
  name: 'Buch',
  ...progress,
  entries: 0,
  introduced: 0,
  ...overrides,
});

describe('practiceStatus', () => {
  it('reports due reviews first, with singular grammar', () => {
    expect(practiceStatus(unit({ due: 1, firstReviews: 3 }))).toBe(
      '1 Wiederholung offen',
    );
  });

  it('reports first reviews when nothing is due', () => {
    expect(practiceStatus(unit({ firstReviews: 2 }))).toBe(
      '2 Karten zum ersten Mal üben',
    );
  });

  it('reports rest when nothing is scheduled', () => {
    expect(practiceStatus(unit({}))).toBe('Für jetzt geschafft');
  });

  it('names the next date when work is only scheduled later', () => {
    expect(
      practiceStatus(unit({ nextDueAt: new Date('2099-01-01') })),
    ).toStartWith('Nächster Termin');
  });
});

describe('progressSummary', () => {
  it('reports an empty unit without practice status', () => {
    expect(
      progressSummary(unit({ entries: 0, introduced: 0 }), vocabulary),
    ).toBe('Noch keine Vokabeln');
  });

  it('names what is left to learn and to review', () => {
    expect(
      progressSummary(
        unit({
          entries: vocabularyCount,
          introduced: vocabularyCount,
          unintroduced: 3,
          due: 2,
        }),
        vocabulary,
      ),
    ).toBe('12 Vokabeln · 3 noch kennenlernen · 2 Wiederholungen offen');
  });

  it('does not call untouched words finished', () => {
    expect(
      progressSummary(
        book({
          entries: vocabularyCount,
          introduced: 0,
          unintroduced: vocabularyCount,
        }),
        vocabulary,
      ),
    ).toBe('12 Vokabeln · 12 noch kennenlernen');
  });

  it('summarizes fully introduced words', () => {
    expect(
      progressSummary(unit({ entries: 1, introduced: 1 }), vocabulary),
    ).toBe('1 Vokabel · Für jetzt geschafft');
  });

  it('counts the terms of a subject', () => {
    expect(progressSummary(unit({ entries: 1, introduced: 1 }), terms)).toBe(
      '1 Begriff · Für jetzt geschafft',
    );
    expect(progressSummary(unit({ entries: 0, introduced: 0 }), terms)).toBe(
      'Noch keine Begriffe',
    );
  });
});

describe('bookSummary', () => {
  it('counts the units of a book and every word in it', () => {
    expect(
      bookSummary(
        book({ entries: 3, unintroduced: 3 }),
        [
          unit({ entries: 10 }),
          unit({ entries: vocabularyCount, unintroduced: 2 }),
        ],
        vocabulary,
      ),
    ).toBe('2 Einheiten · 25 Vokabeln · 5 noch kennenlernen');
  });

  it('leaves units out of a book without any', () => {
    expect(
      bookSummary(book({ entries: vocabularyCount }), [], vocabulary),
    ).toBe('12 Vokabeln');
    expect(bookSummary(book({}), [], vocabulary)).toBe('Noch keine Vokabeln');
  });

  it('names units that are still empty', () => {
    expect(
      bookSummary(book({}), [unit({ entries: 0, introduced: 0 })], vocabulary),
    ).toBe('1 Einheit · noch keine Vokabeln');
    expect(
      bookSummary(book({}), [unit({ entries: 0, introduced: 0 })], terms),
    ).toBe('1 Einheit · noch keine Begriffe');
  });
});
