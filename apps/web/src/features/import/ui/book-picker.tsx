import { useId } from 'react';
import { maximumBookNameLength } from '../../../shared/vocabulary/book-name';
import type { BookSelectionData } from '../schemas/import-payload';
import type { Book } from '../services/repository';
import { FilingInput, FilingSelect } from './filing-select';

const newBookValue = 'new';

type BookPickerProps = {
  readonly books: ReadonlyArray<Book>;
  readonly selection: BookSelectionData;
  readonly disabled: boolean;
  readonly onChange: (selection: BookSelectionData) => void;
};

// The book is chosen once per page. Vocabulary pages rarely print the book's
// title, so it is preselected from the last import rather than read from the
// photo, and a new book only needs its name.
export const BookPicker = ({
  books,
  selection,
  disabled,
  onChange,
}: BookPickerProps) => {
  const selectId = useId();
  const nameId = useId();
  const hintId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {books.length === 0 ? null : (
        <>
          <label className="eyebrow" htmlFor={selectId}>
            Buch
          </label>
          <FilingSelect
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
          </FilingSelect>
        </>
      )}
      {selection.kind === 'new' ? (
        <div
          className={
            books.length === 0
              ? 'flex flex-col gap-1'
              : 'mt-2 flex flex-col gap-1'
          }
        >
          <label className="eyebrow" htmlFor={nameId}>
            Name des Buchs
          </label>
          <FilingInput
            aria-describedby={books.length === 0 ? hintId : undefined}
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
          {books.length === 0 ? (
            <p className="text-muted-foreground text-sm" id={hintId}>
              Aus welchem Buch stammt diese Seite? Weitere Bücher kannst du
              später hinzufügen.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
