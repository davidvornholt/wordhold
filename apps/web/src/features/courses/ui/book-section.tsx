import { type ReactNode, useId, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { cardClass, cardListClass } from '../../../shared/ui/surface-styles';
import { maximumBookNameLength } from '../../../shared/vocabulary/book-name';
import {
  type CourseBook,
  type CourseOutline,
  unitsByBook,
} from '../schemas/course-units';
import { bookTaken } from './book-names';
import { NameForm } from './name-form';
import { bookSummary } from './progress-status';

type BookSectionProps = {
  readonly outline: CourseOutline;
  readonly renderBookLink: (book: CourseBook) => ReactNode;
  // Creates the book and opens its page.
  readonly createBook: (name: string) => Promise<void>;
};

// The language's books in order. Each book's own page holds its words and
// units and is where the book is renamed or divided into units.
export const BookSection = ({
  outline,
  renderBookLink,
  createBook,
}: BookSectionProps) => {
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const headingId = useId();
  const formId = useId();
  const groups = unitsByBook(outline.books, outline.units);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl" id={headingId}>
          Bücher
        </h2>
        <Button
          aria-controls={adding ? formId : undefined}
          aria-expanded={adding}
          onClick={() => setAdding((current) => !current)}
          variant="quiet"
        >
          {adding ? 'Abbrechen' : 'Neues Buch'}
        </Button>
      </div>
      {adding ? (
        <div className={`${cardClass} flex flex-col gap-2`} id={formId}>
          <NameForm
            busy={creating}
            conflict={(name) => bookTaken(outline.books, name)}
            failedStatus="Das Buch wurde nicht angelegt. Versuche es noch einmal."
            label="Name des Buchs"
            maxLength={maximumBookNameLength}
            onBusyChange={setCreating}
            pendingStatus="Buch wird angelegt …"
            placeholder="z. B. Harry Potter"
            save={createBook}
            savedStatus={(name) => `${name} angelegt.`}
            statusLabel="Status beim Anlegen eines Buchs"
            submitLabel="Buch anlegen"
          />
          <p className="text-muted-foreground text-sm">
            Vokabeln kommen direkt ins Buch. Einheiten legst du auf der Seite
            des Buchs an, wenn es welche hat.
          </p>
        </div>
      ) : null}
      {groups.length === 0 ? (
        <p className={`${cardClass} text-sm`}>
          Für diese Sprache gibt es noch keine Bücher. Lege eines an, zum
          Beispiel für einen Roman oder ein Lehrbuch, oder fotografiere eine
          Vokabelseite und gib beim Prüfen an, aus welchem Buch sie stammt.
        </p>
      ) : (
        <ul className={cardListClass}>
          {groups.map(({ book, units }) => (
            <li
              className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/50"
              key={book.id}
            >
              {renderBookLink(book)}
              <span className="text-muted-foreground text-sm">
                {bookSummary(book, units)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
