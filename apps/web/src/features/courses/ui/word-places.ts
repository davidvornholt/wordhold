import { wordLocation } from '../../../shared/vocabulary/book-name';
import type { CourseOutline } from '../schemas/course-units';

export type WordPlace = {
  readonly bookId: string;
  // Null for a word that lives directly in the book.
  readonly unitId: string | null;
};

export type WordPlaceOption = {
  // The unit's id, or the book's for the book itself.
  readonly value: string;
  readonly label: string;
  readonly place: WordPlace;
  readonly lastAddedAt: Date | null;
};

// Every place a typed word can go, in course order: each book, followed by its
// units.
export const wordPlaceOptions = ({
  books,
  units,
}: CourseOutline): ReadonlyArray<WordPlaceOption> =>
  books.flatMap((book) => [
    {
      value: book.id,
      label: book.name,
      place: { bookId: book.id, unitId: null },
      lastAddedAt: book.lastAddedAt,
    },
    ...units
      .filter((unit) => unit.bookId === book.id)
      .map((unit) => ({
        value: unit.id,
        label: wordLocation(book.name, unit.name),
        place: { bookId: book.id, unitId: unit.id },
        lastAddedAt: unit.lastAddedAt,
      })),
  ]);

// The place that received the latest word. Before any word exists, the most
// recently added book, since books are listed in the order they were added.
export const lastUsedWordPlace = (
  options: ReadonlyArray<WordPlaceOption>,
): WordPlaceOption | undefined => {
  const used = options.filter((option) => option.lastAddedAt !== null);
  if (used.length === 0) {
    return options.findLast((option) => option.place.unitId === null);
  }
  return used.reduce((latest, option) =>
    (option.lastAddedAt?.getTime() ?? 0) > (latest.lastAddedAt?.getTime() ?? 0)
      ? option
      : latest,
  );
};
