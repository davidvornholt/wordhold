import { describe, expect, it } from 'bun:test';
import type {
  CourseBook,
  CourseUnit,
  VocabularyEntry,
  WordProgress,
} from '../schemas/course-units';
import type { ApiCourse } from './course-records';
import { searchEntries, toApiEntry, toApiOutline } from './entry-wire';

const language: ApiCourse = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Spanisch',
  kind: 'language',
  targetLanguage: 'es',
};

const terms: ApiCourse = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Biologie',
  kind: 'terms',
  targetLanguage: 'de',
};

const entry = (overrides: Partial<VocabularyEntry>): VocabularyEntry => ({
  id: '00000000-0000-4000-8000-000000000011',
  bookId: '00000000-0000-4000-8000-000000000021',
  bookName: 'Libro 1',
  unitId: '00000000-0000-4000-8000-000000000031',
  unitName: 'Lección 2',
  targetText: 'el café',
  nativeText: 'der Kaffee',
  keyPoints: null,
  synonyms: null,
  antonyms: null,
  spellingPitfalls: null,
  example: null,
  introduced: true,
  cards: [
    {
      cardId: '00000000-0000-4000-8000-000000000041',
      direction: 'to_target',
      state: 'review',
      dueAt: new Date('2026-11-08T09:00:00Z'),
      introducedAt: new Date('2026-10-01T09:00:00Z'),
      failures: 2,
      hardAnswers: 1,
    },
  ],
  ...overrides,
});

const noWords: WordProgress = {
  entries: 0,
  introduced: 0,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  lastAddedAt: null,
  directions: [],
};

const book: CourseBook = {
  ...noWords,
  id: '00000000-0000-4000-8000-000000000021',
  name: 'Libro 1',
  entries: 3,
};

const unit: CourseUnit = {
  ...noWords,
  id: '00000000-0000-4000-8000-000000000031',
  bookId: book.id,
  name: 'Lección 2',
  nextDueAt: new Date('2026-11-08T09:00:00Z'),
};

describe('toApiEntry', () => {
  it('names the book and unit of a word and writes instants in UTC', () => {
    const shown = toApiEntry(language, entry({}));

    expect(shown.book).toEqual({ id: book.id, name: 'Libro 1' });
    expect(shown.unit).toEqual({ id: unit.id, name: 'Lección 2' });
    expect(shown.cards[0]).toEqual({
      direction: 'to_target',
      state: 'review',
      dueAt: '2026-11-08T09:00:00.000Z',
      introducedAt: '2026-10-01T09:00:00.000Z',
      failures: 2,
      hardAnswers: 1,
    });
  });

  it('shows no place for a term, whose book is hidden', () => {
    const shown = toApiEntry(terms, entry({ unitId: null, unitName: null }));

    expect(shown.book).toBeNull();
    expect(shown.unit).toBeNull();
    expect(shown.course).toEqual({
      id: terms.id,
      name: 'Biologie',
      kind: 'terms',
    });
  });
});

describe('toApiOutline', () => {
  it('nests each unit under its book', () => {
    const outline = toApiOutline(language, ['to_target', 'to_native'], {
      books: [book],
      units: [unit],
    });

    expect(outline.books).toHaveLength(1);
    expect(outline.books[0]?.entries).toBe(3);
    expect(outline.books[0]?.units).toEqual([
      {
        id: unit.id,
        name: 'Lección 2',
        entries: 0,
        introduced: 0,
        unintroduced: 0,
        due: 0,
        firstReviews: 0,
        nextDueAt: '2026-11-08T09:00:00.000Z',
      },
    ]);
  });

  it('lists no books for a terms course', () => {
    const outline = toApiOutline(terms, ['to_target'], {
      books: [book],
      units: [],
    });

    expect(outline.books).toEqual([]);
    expect(outline.directions).toEqual(['to_target']);
  });
});

describe('searchEntries', () => {
  const item = (id: string, overrides: Partial<VocabularyEntry>) => ({
    entry: entry({ id, ...overrides }),
  });

  const ids = (items: ReadonlyArray<{ readonly entry: VocabularyEntry }>) =>
    items.map(({ entry: found }) => found.id);

  it('puts exact matches before word starts before other matches', () => {
    const items = [
      item('inside', { targetText: 'el descafeinado', nativeText: 'x' }),
      item('after an article', { targetText: 'la cafetería', nativeText: 'y' }),
      item('after an apostrophe', { targetText: "l'eau", nativeText: 'w' }),
      item('exact', { targetText: 'café', nativeText: 'z' }),
    ];

    expect(ids(searchEntries(items, 'cafe', 10))).toEqual([
      'exact',
      'after an article',
      'inside',
    ]);
    expect(ids(searchEntries(items, 'eau', 10))).toEqual([
      'after an apostrophe',
    ]);
  });

  it('ignores case and accents in the entry and the query', () => {
    const items = [item('word', { targetText: 'el Café' })];

    expect(ids(searchEntries(items, ' EL CAFE ', 10))).toEqual(['word']);
    expect(ids(searchEntries(items, 'él café', 10))).toEqual(['word']);
  });

  it('finds words by synonym, antonym and example', () => {
    const items = [
      item('synonym', {
        targetText: 'a',
        nativeText: 'b',
        synonyms: ['rápido'],
      }),
      item('antonym', {
        targetText: 'c',
        nativeText: 'd',
        antonyms: ['lento'],
      }),
      item('example', {
        targetText: 'e',
        nativeText: 'f',
        example: {
          targetText: 'Tomo un té.',
          nativeText: 'Ich trinke einen Tee.',
          source: 'textbook',
        },
      }),
      item('none', { targetText: 'g', nativeText: 'h' }),
    ];

    expect(ids(searchEntries(items, 'rapido', 10))).toEqual(['synonym']);
    expect(ids(searchEntries(items, 'lento', 10))).toEqual(['antonym']);
    expect(ids(searchEntries(items, 'trinke', 10))).toEqual(['example']);
  });

  it('keeps course order within a rank and stops at the limit', () => {
    const items = [
      item('first', { targetText: 'la casa' }),
      item('second', { targetText: 'la casita' }),
      item('third', { targetText: 'el caso' }),
    ];

    expect(ids(searchEntries(items, 'cas', 2))).toEqual(['first', 'second']);
  });
});
