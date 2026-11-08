import { describe, expect, it } from 'bun:test';
import { Effect, Exit } from 'effect';
import type {
  CourseBook,
  CourseOutline,
  CourseUnit,
  WordProgress,
} from '../schemas/course-units';
import { foundExample, keptExample, wordPlace } from './course-api-work';

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

const firstBook: CourseBook = {
  ...noWords,
  id: '00000000-0000-4000-8000-000000000021',
  name: 'Libro 1',
};

const secondBook: CourseBook = {
  ...noWords,
  id: '00000000-0000-4000-8000-000000000022',
  name: 'Libro 2',
};

const unit: CourseUnit = {
  ...noWords,
  id: '00000000-0000-4000-8000-000000000031',
  bookId: firstBook.id,
  name: 'Lección 1',
  lastAddedAt: new Date('2026-11-01T10:00:00Z'),
};

const outline: CourseOutline = {
  books: [firstBook, secondBook],
  units: [unit],
};

const missingId = '00000000-0000-4000-8000-0000000000ff';

const place = (
  courseOutline: CourseOutline,
  request: Parameters<typeof wordPlace>[1],
) => Effect.runSync(wordPlace(courseOutline, request));

const failure = (
  courseOutline: CourseOutline,
  request: Parameters<typeof wordPlace>[1],
) => {
  const exit = Effect.runSyncExit(wordPlace(courseOutline, request));
  if (Exit.isSuccess(exit)) {
    throw new Error('Expected the place to be refused');
  }
  return JSON.stringify(exit.cause);
};

describe('wordPlace', () => {
  it('puts a word in the unit asked for, inside its book', () => {
    expect(place(outline, { unitId: unit.id })).toEqual({
      bookId: firstBook.id,
      unitId: unit.id,
    });
    expect(place(outline, { bookId: firstBook.id, unitId: unit.id })).toEqual({
      bookId: firstBook.id,
      unitId: unit.id,
    });
  });

  it('puts a word directly in the book asked for', () => {
    expect(place(outline, { bookId: secondBook.id })).toEqual({
      bookId: secondBook.id,
      unitId: null,
    });
  });

  it('refuses a unit from another book and places the course lacks', () => {
    expect(
      failure(outline, { bookId: secondBook.id, unitId: unit.id }),
    ).toContain('The unit is not in that book.');
    expect(failure(outline, { unitId: missingId })).toContain(
      'This course has no such unit.',
    );
    expect(failure(outline, { bookId: missingId })).toContain(
      'This course has no such book.',
    );
  });

  it('otherwise uses the place the last word went, like the app’s form', () => {
    expect(place(outline, {})).toEqual({
      bookId: firstBook.id,
      unitId: unit.id,
    });
  });

  it('asks for a book first when the course has none', () => {
    expect(failure({ books: [], units: [] }, {})).toContain(
      'The course has no book yet.',
    );
  });
});

describe('examples', () => {
  it('stores a given example as one the owner came across', () => {
    expect(foundExample({ targetText: 'Tomo un café.' })).toEqual({
      targetText: 'Tomo un café.',
      source: 'textbook',
    });
  });

  it('gives a stored example back unchanged, AI-written or not', () => {
    expect(
      keptExample({
        targetText: 'Tomo un café.',
        nativeText: null,
        source: 'generated',
      }),
    ).toEqual({ targetText: 'Tomo un café.', source: 'generated' });
    expect(keptExample(null)).toBeUndefined();
  });
});
