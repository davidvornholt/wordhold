import { type ReactNode, useId } from 'react';
import { cardClass, cardListClass } from '../../../shared/ui/surface-styles';
import { maximumBookNameLength } from '../../../shared/vocabulary/book-name';
import {
  type CourseBook,
  type CourseOutline,
  unitsByBook,
} from '../schemas/course-units';
import { bookTaken } from './book-names';
import { NameDialog } from './name-dialog';
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
  const headingId = useId();
  const groups = unitsByBook(outline.books, outline.units);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl" id={headingId}>
          Bücher
        </h2>
        <NameDialog
          conflict={(name) => bookTaken(outline.books, name)}
          description={
            <p className="text-muted-foreground">
              Vokabeln kommen direkt ins Buch. Einheiten legst du auf der Seite
              des Buchs an, wenn es welche hat.
            </p>
          }
          failedMessage="Das Buch wurde nicht angelegt. Versuche es noch einmal."
          label="Name des Buchs"
          maxLength={maximumBookNameLength}
          openLabel="Neues Buch"
          pendingLabel="Buch wird angelegt …"
          placeholder="z. B. Harry Potter"
          save={createBook}
          submitLabel="Buch anlegen"
          title="Neues Buch"
        />
      </div>
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
