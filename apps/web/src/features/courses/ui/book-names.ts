import type { CourseSubject } from '../../../shared/directions';
import type { CourseBook } from '../schemas/course-units';

// A language's books are novels and textbooks; a subject's are textbooks
// and lecture notes.
export const bookPlaceholder = ({ kind }: CourseSubject): string =>
  kind === 'terms' ? 'z. B. Vorlesungsskript' : 'z. B. Harry Potter';

// Book names are unique within a course. Returns the message to show
// instead of saving, or null when the name is free.
export const bookTaken = (
  books: ReadonlyArray<CourseBook>,
  name: string,
  exceptBookId?: string,
): string | null =>
  books.some((book) => book.name === name && book.id !== exceptBookId)
    ? `Das Buch "${name}" gibt es bereits.`
    : null;
