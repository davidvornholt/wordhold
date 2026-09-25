import { useId } from 'react';
import { fieldCompactClass } from '../../../shared/ui/field-styles';
import { maximumBookNameLength } from '../../../shared/vocabulary/book-name';
import type { BookSelectionData } from '../schemas/import-payload';
import type { Book } from '../services/repository';

const newBookValue = 'new';

type BookAssignmentProps = {
  readonly books: ReadonlyArray<Book>;
  readonly selection: BookSelectionData;
  readonly disabled: boolean;
  readonly onChange: (selection: BookSelectionData) => void;
};

// The book is chosen once per page. Vocabulary pages rarely print the book's
// title, so it is preselected from the last import rather than read from the
// photo, and a new book only needs its name.
export const BookAssignment = ({
  books,
  selection,
  disabled,
  onChange,
}: BookAssignmentProps) => {
  const selectId = useId();
  const nameId = useId();
  return (
    <fieldset className="flex flex-col gap-3 border border-border bg-card p-3">
      <legend className="px-1 font-display text-xl">Buch</legend>
      <p className="text-muted-foreground text-sm">
        {books.length === 0
          ? 'Aus welchem Buch stammt diese Seite? Weitere Bücher kannst du später hinzufügen.'
          : 'Gilt für die ganze Seite. Die Einheiten unten gehören zu diesem Buch.'}
      </p>
      {books.length === 0 ? null : (
        <label className="flex flex-col gap-1 text-sm" htmlFor={selectId}>
          Buch dieser Seite
          <select
            className={fieldCompactClass}
            disabled={disabled}
            id={selectId}
            onChange={(event) =>
              onChange(
                event.target.value === newBookValue
                  ? { kind: 'new', name: '' }
                  : { kind: 'existing', bookId: event.target.value },
              )
            }
            value={
              selection.kind === 'existing' ? selection.bookId : newBookValue
            }
          >
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.name}
              </option>
            ))}
            <option value={newBookValue}>Neues Buch …</option>
          </select>
        </label>
      )}
      {selection.kind === 'new' ? (
        <label className="flex flex-col gap-1 text-sm" htmlFor={nameId}>
          Name des Buchs
          <input
            className={fieldCompactClass}
            disabled={disabled}
            id={nameId}
            maxLength={maximumBookNameLength}
            onChange={(event) =>
              onChange({ kind: 'new', name: event.target.value })
            }
            placeholder="z. B. Encuentros hoy 3"
            required={true}
            value={selection.name}
          />
        </label>
      ) : null}
    </fieldset>
  );
};
