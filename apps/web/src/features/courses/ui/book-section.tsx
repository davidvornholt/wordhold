import { type ReactNode, useId, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { cardClass, cardListClass } from '../../../shared/ui/surface-styles';
import {
  type CourseBook,
  type CourseOutline,
  unitsByBook,
} from '../schemas/course-units';
import { type CourseBookActions, CourseBookEditor } from './course-book-editor';
import { bookSummary } from './progress-status';

type BookSectionProps = CourseBookActions & {
  readonly outline: CourseOutline;
  readonly renderBookLink: (book: CourseBook) => ReactNode;
};

// The course's books in course order. Each book's own page holds its words
// and units.
export const BookSection = ({
  outline,
  renderBookLink,
  ...actions
}: BookSectionProps) => {
  const [editing, setEditing] = useState(false);
  const headingId = useId();
  const groups = unitsByBook(outline.books, outline.units);
  let content: ReactNode;
  if (editing) {
    content = <CourseBookEditor initialOutline={outline} {...actions} />;
  } else if (groups.length === 0) {
    content = (
      <p className={`${cardClass} text-sm`}>
        Dieser Kurs hat noch keine Bücher. Fotografiere eine Vokabelseite und
        gib beim Prüfen an, aus welchem Buch sie stammt.
      </p>
    );
  } else {
    content = (
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
    );
  }
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl" id={headingId}>
          Bücher
        </h2>
        <Button
          aria-expanded={editing}
          onClick={() => setEditing((current) => !current)}
          variant="quiet-muted"
        >
          {editing ? 'Fertig' : 'Bearbeiten'}
        </Button>
      </div>
      {content}
    </section>
  );
};
