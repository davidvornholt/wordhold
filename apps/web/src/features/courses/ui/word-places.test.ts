import { describe, expect, it } from 'bun:test';
import type {
  CourseBook,
  CourseOutline,
  CourseUnit,
  WordProgress,
} from '../schemas/course-units';
import { lastUsedWordPlace, wordPlaceOptions } from './word-places';

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

const textbook: CourseBook = {
  ...noWords,
  id: '00000000-0000-0000-0000-000000000011',
  name: 'Green Line 3',
};

const novel: CourseBook = {
  ...noWords,
  id: '00000000-0000-0000-0000-000000000012',
  name: 'The Hobbit',
};

const unit: CourseUnit = {
  ...noWords,
  bookId: textbook.id,
  id: '00000000-0000-0000-0000-000000000021',
  name: 'Unit 1',
};

const outline = (
  books: ReadonlyArray<CourseBook>,
  units: ReadonlyArray<CourseUnit>,
): CourseOutline => ({ books, units });

describe('wordPlaceOptions', () => {
  it('lists each book before its units, in course order', () => {
    expect(
      wordPlaceOptions(outline([textbook, novel], [unit])).map(
        ({ label, place }) => ({ label, place }),
      ),
    ).toEqual([
      { label: 'Green Line 3', place: { bookId: textbook.id, unitId: null } },
      {
        label: 'Green Line 3 · Unit 1',
        place: { bookId: textbook.id, unitId: unit.id },
      },
      { label: 'The Hobbit', place: { bookId: novel.id, unitId: null } },
    ]);
  });
});

describe('lastUsedWordPlace', () => {
  it('picks the place that received the latest word', () => {
    const options = wordPlaceOptions(
      outline(
        [
          { ...textbook, lastAddedAt: new Date('2026-09-01T10:00:00Z') },
          { ...novel, lastAddedAt: new Date('2026-09-20T10:00:00Z') },
        ],
        [{ ...unit, lastAddedAt: new Date('2026-09-10T10:00:00Z') }],
      ),
    );
    expect(lastUsedWordPlace(options)?.label).toBe('The Hobbit');
  });

  it('falls back to the newest book before any word exists', () => {
    const options = wordPlaceOptions(outline([textbook, novel], [unit]));
    expect(lastUsedWordPlace(options)?.label).toBe('The Hobbit');
  });

  it('has nothing to offer without a book', () => {
    expect(
      lastUsedWordPlace(wordPlaceOptions(outline([], []))),
    ).toBeUndefined();
  });
});
