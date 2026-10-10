import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { CardState } from '@wordhold/db/schema/practice';
import type { ExampleSentence } from '../../../shared/examples/example-model';

// How far the learner has come with one set of words: a unit's, or the words
// that live directly in a book. Introduced entries participate in the regular
// learning plan. An explicit vocabulary selection may also practise entries
// before their learning pass.
export type WordProgress = {
  readonly entries: number;
  readonly introduced: number;
  readonly unintroduced: number;
  readonly due: number;
  readonly firstReviews: number;
  readonly nextDueAt: Date | null;
  // When a word was last added here, so a new word can default to the place
  // the learner filled most recently. Null while there are no words.
  readonly lastAddedAt: Date | null;
  readonly directions: ReadonlyArray<DirectionProgress>;
};

// A book of the course, in the order the course page lists them. Its progress
// covers only the words that live directly in it; each unit has its own.
export type CourseBook = WordProgress & {
  readonly id: string;
  readonly name: string;
};

// The course's books and units, which the course page and the practice
// screens read together.
export type CourseOutline = {
  readonly books: ReadonlyArray<CourseBook>;
  readonly units: ReadonlyArray<CourseUnit>;
};

// A unit as the course page lists it.
export type CourseUnit = WordProgress & {
  readonly id: string;
  readonly bookId: string;
  readonly name: string;
};

export type DirectionProgress = {
  readonly direction: AnswerDirection;
  readonly total: number;
  readonly introduced: number;
  readonly unintroduced: number;
  readonly due: number;
  readonly firstReviews: number;
  readonly nextDueAt: Date | null;
};

export type RecommendedAction = {
  readonly kind: 'learn' | 'practice';
  readonly direction: AnswerDirection;
};

export type VocabularyCard = {
  readonly cardId: string;
  readonly direction: AnswerDirection;
  readonly state: CardState;
  readonly dueAt: Date | null;
  readonly introducedAt: Date | null;
  readonly failures: number;
};

export type VocabularyEntry = {
  readonly id: string;
  readonly bookId: string;
  readonly bookName: string;
  // Null for a word that lives directly in its book.
  readonly unitId: string | null;
  readonly unitName: string | null;
  readonly targetText: string;
  readonly nativeText: string;
  // What a definition must state, for a term; null for a word, and for a
  // term whose key points are not derived yet.
  readonly keyPoints: ReadonlyArray<string> | null;
  // For a word: synonyms and antonyms, each null until settled. Null for a
  // term or text.
  readonly synonyms: ReadonlyArray<string> | null;
  readonly antonyms: ReadonlyArray<string> | null;
  readonly example: VocabularyExample | null;
  readonly introduced: boolean;
  readonly cards: ReadonlyArray<VocabularyCard>;
};

export type VocabularyExample = ExampleSentence;

export const openLearningDirections = (
  progress: WordProgress,
): ReadonlyArray<DirectionProgress> =>
  progress.directions.filter((direction) => direction.unintroduced > 0);

export const recommendedAction = (
  progress: WordProgress,
): RecommendedAction | null => {
  const dueDirections = progress.directions.filter(
    (direction) => direction.due > 0,
  );
  if (dueDirections.length > 0) {
    const due = dueDirections.length === 1 ? dueDirections.at(0) : undefined;
    return due === undefined
      ? null
      : { kind: 'practice', direction: due.direction };
  }
  const firstReviewDirections = progress.directions.filter(
    (direction) => direction.firstReviews > 0,
  );
  if (firstReviewDirections.length > 0) {
    const firstReview =
      firstReviewDirections.length === 1
        ? firstReviewDirections.at(0)
        : undefined;
    return firstReview === undefined
      ? null
      : { kind: 'practice', direction: firstReview.direction };
  }
  const learning = openLearningDirections(progress);
  if (learning.length === 1) {
    const onlyDirection = learning.at(0);
    return onlyDirection === undefined
      ? null
      : { kind: 'learn', direction: onlyDirection.direction };
  }
  const startedDirections = learning.filter(
    (direction) => direction.introduced > 0,
  );
  const started =
    startedDirections.length === 1 ? startedDirections.at(0) : undefined;
  return started === undefined
    ? null
    : { kind: 'learn', direction: started.direction };
};

// The course's own totals, summed from the outline rather than queried again:
// every entry lives either directly in one book or in one unit, so the books'
// and units' progress together already holds them.
export const courseTotals = ({
  books,
  units,
}: CourseOutline): {
  readonly entries: number;
  readonly unintroduced: number;
} =>
  [...books, ...units].reduce(
    (totals, place) => ({
      entries: totals.entries + place.entries,
      unintroduced: totals.unintroduced + place.unintroduced,
    }),
    { entries: 0, unintroduced: 0 },
  );

// Each book with its units, in course order. A book without units is kept so
// a freshly added book shows up before its first import.
export const unitsByBook = (
  books: ReadonlyArray<CourseBook>,
  units: ReadonlyArray<CourseUnit>,
): ReadonlyArray<{
  readonly book: CourseBook;
  readonly units: ReadonlyArray<CourseUnit>;
}> =>
  books.map((book) => ({
    book,
    units: units.filter((unit) => unit.bookId === book.id),
  }));
