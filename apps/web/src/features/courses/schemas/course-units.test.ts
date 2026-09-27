import { describe, expect, it } from 'bun:test';
import type { DirectionProgress } from './course-units';
import { courseTotals, recommendedAction, unitsByBook } from './course-units';

// A unit part-way through the learning pass, and one that is finished with it.
const mixedEntries = 18;
const mixedUnintroduced = 2;
const introducedEntries = 16;
const bothUnits = mixedEntries + introducedEntries;

const progress = (
  direction: DirectionProgress['direction'],
  overrides: Partial<DirectionProgress>,
): DirectionProgress => ({
  direction,
  total: mixedEntries,
  introduced: 0,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  ...overrides,
});

const words = (entries: number, introduced: number, unintroduced: number) => ({
  entries,
  introduced,
  unintroduced,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  lastAddedAt: null,
  directions: [],
});

const book = (id: string, name: string, entries = 0) => ({
  ...words(entries, entries, 0),
  id,
  name,
});

const unit = (entries: number, introduced: number, unintroduced: number) => ({
  ...words(entries, introduced, unintroduced),
  bookId: '00000000-0000-0000-0000-000000000009',
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Unit 3 – Holidays',
});

describe('courseTotals', () => {
  it('sums the units of the course', () => {
    expect(
      courseTotals({
        books: [],
        units: [
          unit(mixedEntries, introducedEntries, mixedUnintroduced),
          unit(introducedEntries, introducedEntries, 0),
        ],
      }),
    ).toEqual({ entries: bothUnits, unintroduced: mixedUnintroduced });
  });

  it("counts the words that live directly in a book alongside its units' words", () => {
    const novelWords = 7;
    expect(
      courseTotals({
        books: [
          {
            ...book('00000000-0000-0000-0000-000000000009', 'Novel'),
            ...words(novelWords, 0, novelWords),
          },
        ],
        units: [unit(mixedEntries, introducedEntries, mixedUnintroduced)],
      }),
    ).toEqual({
      entries: novelWords + mixedEntries,
      unintroduced: novelWords + mixedUnintroduced,
    });
  });

  it('reports zero for a course without books', () => {
    expect(courseTotals({ books: [], units: [] })).toEqual({
      entries: 0,
      unintroduced: 0,
    });
  });
});

describe('recommendedAction', () => {
  it('recommends due practice before opening another learning path', () => {
    expect(
      recommendedAction({
        ...unit(mixedEntries, mixedEntries, mixedUnintroduced),
        directions: [
          progress('to_target', { introduced: mixedEntries, due: 2 }),
          progress('to_native', { unintroduced: mixedUnintroduced }),
        ],
      }),
    ).toEqual({ kind: 'practice', direction: 'to_target' });
  });

  it('does not invent an order when both paths have due reviews', () => {
    expect(
      recommendedAction({
        ...unit(mixedEntries, mixedEntries, 0),
        directions: [
          progress('to_target', { introduced: mixedEntries, due: 2 }),
          progress('to_native', { introduced: mixedEntries, due: 1 }),
        ],
      }),
    ).toBeNull();
  });

  it('does not invent an order when both paths have first reviews', () => {
    expect(
      recommendedAction({
        ...unit(mixedEntries, mixedEntries, 0),
        directions: [
          progress('to_target', {
            introduced: mixedEntries,
            firstReviews: 2,
          }),
          progress('to_native', {
            introduced: mixedEntries,
            firstReviews: 1,
          }),
        ],
      }),
    ).toBeNull();
  });

  it('recommends the direction that still needs learning', () => {
    expect(
      recommendedAction({
        ...unit(mixedEntries, mixedEntries, mixedUnintroduced),
        directions: [
          progress('to_target', { introduced: mixedEntries }),
          progress('to_native', { unintroduced: mixedUnintroduced }),
        ],
      }),
    ).toEqual({ kind: 'learn', direction: 'to_native' });
  });

  it('does not invent an order for two untouched learning paths', () => {
    expect(
      recommendedAction({
        ...unit(mixedEntries, 0, mixedEntries),
        directions: [
          progress('to_target', { unintroduced: mixedEntries }),
          progress('to_native', { unintroduced: mixedEntries }),
        ],
      }),
    ).toBeNull();
  });

  it('recommends continuing the only started path', () => {
    expect(
      recommendedAction({
        ...unit(mixedEntries, introducedEntries, mixedUnintroduced),
        directions: [
          progress('to_target', {
            introduced: introducedEntries,
            unintroduced: mixedUnintroduced,
          }),
          progress('to_native', { unintroduced: mixedEntries }),
        ],
      }),
    ).toEqual({ kind: 'learn', direction: 'to_target' });
  });

  it('recommends nothing while every learned path is resting', () => {
    expect(
      recommendedAction({
        ...unit(mixedEntries, mixedEntries, 0),
        directions: [
          progress('to_target', { introduced: mixedEntries }),
          progress('to_native', { introduced: mixedEntries }),
        ],
      }),
    ).toBeNull();
  });
});

describe('unitsByBook', () => {
  it('keeps same-named units apart and lists books without units', () => {
    const earlier = book(
      '00000000-0000-0000-0000-000000000011',
      'Encuentros hoy 2',
    );
    const current = book(
      '00000000-0000-0000-0000-000000000012',
      'Encuentros hoy 3',
    );
    const later = book(
      '00000000-0000-0000-0000-000000000013',
      'Encuentros hoy 4',
    );
    const earlierUnit = {
      ...unit(1, 1, 0),
      bookId: earlier.id,
      id: '00000000-0000-0000-0000-000000000021',
      name: 'U1 Acércate',
    };
    const currentUnit = {
      ...unit(1, 1, 0),
      bookId: current.id,
      id: '00000000-0000-0000-0000-000000000022',
      name: 'U1 Acércate',
    };
    expect(
      unitsByBook([earlier, current, later], [currentUnit, earlierUnit]),
    ).toEqual([
      { book: earlier, units: [earlierUnit] },
      { book: current, units: [currentUnit] },
      { book: later, units: [] },
    ]);
  });
});
