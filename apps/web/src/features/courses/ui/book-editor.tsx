import { type ReactNode, useId, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { maximumBookNameLength } from '../../../shared/vocabulary/book-name';
import type { CourseBook, CourseUnit } from '../schemas/course-units';
import { bookTaken } from './book-names';
import { NameDialog } from './name-dialog';
import { UnitOrderEditor } from './unit-order-editor';

type BookEditorProps = {
  readonly book: CourseBook;
  // Every book of the language, so a new name is checked against the others.
  readonly books: ReadonlyArray<CourseBook>;
  readonly units: ReadonlyArray<CourseUnit>;
  readonly renameBook: (name: string) => Promise<void>;
  // Each unit change returns the book's units in their saved order.
  readonly createUnit: (name: string) => Promise<ReadonlyArray<CourseUnit>>;
  readonly reorderUnits: (
    expectedUnitIds: ReadonlyArray<string>,
    unitIds: ReadonlyArray<string>,
  ) => Promise<ReadonlyArray<CourseUnit>>;
};

const BookEditor = ({
  book,
  books,
  units,
  renameBook,
  createUnit,
  reorderUnits,
}: BookEditorProps) => {
  const [renamed, setRenamed] = useState('');
  const unitsHeadingId = useId();
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <NameDialog
          conflict={(name) => bookTaken(books, name, book.id)}
          failedMessage="Das Buch wurde nicht umbenannt. Versuche es noch einmal."
          initialName={book.name}
          label="Buchname"
          maxLength={maximumBookNameLength}
          openLabel="Buch umbenennen"
          pendingLabel="Buch wird umbenannt …"
          placeholder="z. B. Harry Potter"
          save={async (name) => {
            await renameBook(name);
            setRenamed(`Umbenannt in ${name}.`);
          }}
          submitLabel="Umbenennen"
          title="Buch umbenennen"
        />
        <output
          aria-label="Status beim Umbenennen des Buchs"
          className="text-sm"
        >
          {renamed}
        </output>
      </div>
      <section aria-labelledby={unitsHeadingId} className="flex flex-col gap-3">
        <h2 className="font-display text-xl" id={unitsHeadingId}>
          Einheiten
        </h2>
        <p className="text-muted-foreground text-sm">
          Einheiten sind optional. Lege sie an, wenn das Buch in Lektionen
          gegliedert ist, wie ein Lehrbuch. Ziehe sie in die Reihenfolge des
          Buchs oder verschiebe sie mit den Pfeiltasten. Änderungen werden
          sofort gespeichert.
        </p>
        <UnitOrderEditor
          bookName={book.name}
          createUnit={createUnit}
          initialUnits={units}
          reorderUnits={reorderUnits}
        />
      </section>
    </div>
  );
};

type EditableBookProps = BookEditorProps & {
  readonly summary: string;
  // What the book page shows while it is not being edited.
  readonly children: ReactNode;
};

// The book page's edit mode: renaming the book and arranging or adding its
// units replace the page's words and units until editing is done.
export const EditableBook = ({
  summary,
  children,
  ...editor
}: EditableBookProps) => {
  const [editing, setEditing] = useState(false);
  const editorId = useId();
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">{summary}</p>
        <Button
          aria-controls={editing ? editorId : undefined}
          aria-expanded={editing}
          onClick={() => setEditing((current) => !current)}
          variant="quiet-muted"
        >
          {editing ? 'Fertig' : 'Bearbeiten'}
        </Button>
      </div>
      {editing ? (
        <div id={editorId}>
          <BookEditor {...editor} />
        </div>
      ) : (
        children
      )}
    </>
  );
};
