import { describe, expect, it } from 'bun:test';
import { Effect, Exit } from 'effect';
import type {
  CourseBook,
  CourseOutline,
  CourseUnit,
  WordProgress,
} from '../schemas/course-units';
import {
  createdUnit,
  editedExample,
  givenExample,
  keptExample,
  relatedWordsAfterEdit,
  wordPlace,
} from './course-api-work';

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

// Two requests may each add a unit to the course before either reads the
// outline back, so the outline after a creation can list another request's
// new unit ahead of the requested one. `outline` is the course before both.
describe('createdUnit', () => {
  const requested: CourseUnit = {
    ...noWords,
    id: '00000000-0000-4000-8000-000000000041',
    bookId: secondBook.id,
    name: 'Lección 2',
  };

  it('finds the requested unit when another request first added one to the same book', () => {
    const otherRequest: CourseUnit = {
      ...noWords,
      id: '00000000-0000-4000-8000-000000000042',
      bookId: secondBook.id,
      name: 'Lección 1',
    };
    expect(
      createdUnit(
        { books: outline.books, units: [unit, otherRequest, requested] },
        { bookId: secondBook.id, name: 'Lección 2' },
      ),
    ).toEqual(requested);
  });

  it('finds the requested unit when another request first added one of the same name to another book', () => {
    const otherRequest: CourseUnit = {
      ...noWords,
      id: '00000000-0000-4000-8000-000000000043',
      bookId: firstBook.id,
      name: 'Lección 2',
    };
    expect(
      createdUnit(
        { books: outline.books, units: [unit, otherRequest, requested] },
        { bookId: secondBook.id, name: 'Lección 2' },
      ),
    ).toEqual(requested);
  });

  it('finds nothing when the outline lacks the unit', () => {
    expect(
      createdUnit(outline, { bookId: secondBook.id, name: 'Lección 2' }),
    ).toBeUndefined();
  });
});

describe('examples', () => {
  it('stores a given example as one the owner came across', () => {
    expect(givenExample({ targetText: 'Tomo un café.' })).toEqual({
      targetText: 'Tomo un café.',
      source: 'textbook',
    });
  });

  it('stores a given example as AI-written when the request says so', () => {
    expect(
      givenExample({ targetText: 'Tomo un café.', source: 'generated' }),
    ).toEqual({ targetText: 'Tomo un café.', source: 'generated' });
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

describe('the example an edit stores', () => {
  const written = {
    targetText: 'Tomo un café.',
    nativeText: 'Ich trinke einen Kaffee.',
    source: 'generated',
  } as const;

  it('keeps the stored example when the edit leaves it out', () => {
    expect(editedExample(written, undefined)).toEqual(written);
    expect(editedExample(written, null)).toBeUndefined();
  });

  it('keeps the source of a repeated sentence that names none', () => {
    expect(
      editedExample(written, {
        targetText: written.targetText,
        nativeText: 'Ich nehme einen Kaffee.',
      }),
    ).toEqual({ ...written, nativeText: 'Ich nehme einen Kaffee.' });
  });

  it('takes the source the edit names, and treats a new sentence as found', () => {
    expect(
      editedExample(
        { ...written, source: 'textbook' },
        { targetText: written.targetText, source: 'generated' },
      ),
    ).toEqual({ targetText: written.targetText, source: 'generated' });
    expect(editedExample(written, { targetText: 'Tomo un té.' })).toEqual({
      targetText: 'Tomo un té.',
      source: 'textbook',
    });
  });
});

describe('synonyms and antonyms after an edit', () => {
  it('keeps a stored list, settled or not, that the edit leaves out', () => {
    expect(relatedWordsAfterEdit(['le copain'], undefined, 'le pote')).toEqual([
      'le copain',
    ]);
    expect(relatedWordsAfterEdit(null, undefined, 'le pote')).toBeNull();
  });

  it('replaces the list with the words given, each once and without the word itself', () => {
    expect(
      relatedWordsAfterEdit(
        ['le camarade'],
        ['le copain', ' Le  copain', 'le pote', "l'ami"],
        'le pote',
      ),
    ).toEqual(['le copain', "l'ami"]);
  });

  it('settles an empty list as none', () => {
    expect(relatedWordsAfterEdit(['le copain'], [], 'le pote')).toEqual([]);
  });
});
