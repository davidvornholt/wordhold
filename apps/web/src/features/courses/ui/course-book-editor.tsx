import { useId, useState } from 'react';
import { maximumBookNameLength } from '../../../shared/vocabulary/book-name';
import type {
  CourseBook,
  CourseOutline,
  CourseUnit,
} from '../schemas/course-units';
import { unitsByBook } from '../schemas/course-units';
import { NameForm } from './name-form';
import { UnitOrderEditor } from './unit-order-editor';

export type CourseBookActions = {
  readonly createBook: (name: string) => Promise<CourseOutline>;
  readonly renameBook: (bookId: string, name: string) => Promise<CourseOutline>;
  readonly createUnit: (bookId: string, name: string) => Promise<CourseOutline>;
  readonly reorderUnits: (
    bookId: string,
    expectedUnitIds: ReadonlyArray<string>,
    unitIds: ReadonlyArray<string>,
  ) => Promise<CourseOutline>;
};

type CourseBookEditorProps = CourseBookActions & {
  readonly initialOutline: CourseOutline;
};

const bookTaken = (
  books: ReadonlyArray<CourseBook>,
  name: string,
  exceptBookId?: string,
): string | null =>
  books.some((book) => book.name === name && book.id !== exceptBookId)
    ? `Das Buch "${name}" gibt es bereits.`
    : null;

const unitsOf = (
  outline: CourseOutline,
  bookId: string,
): ReadonlyArray<CourseUnit> =>
  outline.units.filter((unit) => unit.bookId === bookId);

const BookEditor = ({
  book,
  books,
  units,
  actions,
  onOutlineChange,
}: {
  readonly book: CourseBook;
  readonly books: ReadonlyArray<CourseBook>;
  readonly units: ReadonlyArray<CourseUnit>;
  readonly actions: CourseBookActions;
  readonly onOutlineChange: (outline: CourseOutline) => void;
}) => {
  const [renaming, setRenaming] = useState(false);
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 className="font-display text-lg" id={headingId}>
        {book.name}
      </h3>
      <NameForm
        busy={renaming}
        conflict={(name) => bookTaken(books, name, book.id)}
        failedStatus="Das Buch wurde nicht umbenannt. Versuche es noch einmal."
        initialName={book.name}
        label="Buchname"
        maxLength={maximumBookNameLength}
        onBusyChange={setRenaming}
        pendingStatus="Buch wird umbenannt …"
        placeholder="z. B. Encuentros hoy 2"
        save={async (name) =>
          onOutlineChange(await actions.renameBook(book.id, name))
        }
        savedStatus={(name) => `Umbenannt in ${name}.`}
        statusLabel={`Status beim Umbenennen von ${book.name}`}
        submitLabel="Umbenennen"
      />
      <UnitOrderEditor
        bookName={book.name}
        createUnit={async (name) =>
          unitsOf(await actions.createUnit(book.id, name), book.id)
        }
        initialUnits={units}
        reorderUnits={async (expectedUnitIds, unitIds) =>
          unitsOf(
            await actions.reorderUnits(book.id, expectedUnitIds, unitIds),
            book.id,
          )
        }
      />
    </section>
  );
};

// Edit mode of the course page: each book can be renamed and its units
// arranged or extended, and a further book can be added at the end.
export const CourseBookEditor = ({
  initialOutline,
  ...actions
}: CourseBookEditorProps) => {
  const [outline, setOutline] = useState(initialOutline);
  const [addingBook, setAddingBook] = useState(false);
  return (
    <div className="flex flex-col gap-8">
      <p className="text-muted-foreground text-sm">
        Ziehe Einheiten in die Reihenfolge des Buchs. Du kannst sie auch mit den
        Pfeiltasten verschieben. Änderungen werden sofort gespeichert.
      </p>
      {unitsByBook(outline.books, outline.units).map(({ book, units }) => (
        <BookEditor
          actions={actions}
          book={book}
          books={outline.books}
          key={book.id}
          onOutlineChange={setOutline}
          units={units}
        />
      ))}
      <div className="flex flex-col gap-2">
        <NameForm
          busy={addingBook}
          conflict={(name) => bookTaken(outline.books, name)}
          failedStatus="Das Buch wurde nicht hinzugefügt. Versuche es noch einmal."
          label="Neues Buch"
          maxLength={maximumBookNameLength}
          onBusyChange={setAddingBook}
          pendingStatus="Buch wird hinzugefügt …"
          placeholder="z. B. Encuentros hoy 3"
          save={async (name) => setOutline(await actions.createBook(name))}
          savedStatus={(name) => `${name} hinzugefügt.`}
          statusLabel="Status beim Hinzufügen eines Buchs"
          submitLabel="Buch hinzufügen"
        />
      </div>
    </div>
  );
};
