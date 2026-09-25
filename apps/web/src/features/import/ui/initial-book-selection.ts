import type { BookSelectionData } from '../schemas/import-payload';
import type { Book, Unit } from '../services/repository';

// The page most likely comes from the book the learner filed words into last.
// A course whose books are all still empty starts with its last book, and a
// course without books asks for the first book's name.
export const initialBookSelection = (
  books: ReadonlyArray<Book>,
): BookSelectionData => {
  const lastUsed = books
    .filter(
      (book): book is Book & { readonly lastImportedAt: Date } =>
        book.lastImportedAt !== null,
    )
    .toSorted(
      (first, second) =>
        second.lastImportedAt.getTime() - first.lastImportedAt.getTime(),
    )
    .at(0);
  const selected = lastUsed ?? books.at(-1);
  return selected === undefined
    ? { kind: 'new', name: '' }
    : { kind: 'existing', bookId: selected.id };
};

export const bookSelectionIsComplete = (
  selection: BookSelectionData,
): boolean => selection.kind === 'existing' || selection.name.trim() !== '';

// A new book starts without units, so every row then names a new unit.
export const unitsInBook = (
  units: ReadonlyArray<Unit>,
  selection: BookSelectionData,
): ReadonlyArray<Unit> =>
  selection.kind === 'existing'
    ? units.filter((unit) => unit.bookId === selection.bookId)
    : [];

// Only picking a different book invalidates the rows' units; typing a new
// book's name letter by letter keeps them.
export const bookChanged = (
  previous: BookSelectionData,
  next: BookSelectionData,
): boolean =>
  previous.kind !== next.kind ||
  (previous.kind === 'existing' &&
    next.kind === 'existing' &&
    previous.bookId !== next.bookId);
