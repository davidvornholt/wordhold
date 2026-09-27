import type { CourseBook } from '../schemas/course-units';

// Book names are unique within a language. Returns the message to show
// instead of saving, or null when the name is free.
export const bookTaken = (
  books: ReadonlyArray<CourseBook>,
  name: string,
  exceptBookId?: string,
): string | null =>
  books.some((book) => book.name === name && book.id !== exceptBookId)
    ? `Das Buch "${name}" gibt es bereits.`
    : null;
