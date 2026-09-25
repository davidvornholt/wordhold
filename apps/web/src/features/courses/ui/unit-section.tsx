import { type ReactNode, useId, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { cardClass } from '../../../shared/ui/surface-styles';
import {
  type CourseOutline,
  type CourseUnit,
  unitsByBook,
} from '../schemas/course-units';
import { type CourseBookActions, CourseBookEditor } from './course-book-editor';
import { UnitList } from './unit-list';
import { bookSummary, initiallyOpenBooks } from './unit-status';

type UnitSectionProps = CourseBookActions & {
  readonly outline: CourseOutline;
  readonly renderUnitLink: (unit: CourseUnit) => ReactNode;
};

export const UnitSection = ({
  outline,
  renderUnitLink,
  ...actions
}: UnitSectionProps) => {
  const [editing, setEditing] = useState(false);
  const headingId = useId();
  const groups = unitsByBook(outline.books, outline.units);
  const initiallyOpen = initiallyOpenBooks(groups);
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
    content = groups.map(({ book, units }) => (
      <details
        className="group"
        key={book.id}
        open={initiallyOpen.has(book.id)}
      >
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-baseline gap-x-3 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className="text-muted-foreground group-open:rotate-90"
          >
            ▸
          </span>
          <span className="font-display text-lg">{book.name}</span>
          <span className="text-muted-foreground text-sm">
            {bookSummary(units)}
          </span>
        </summary>
        <div className="pt-3">
          <UnitList renderUnitLink={renderUnitLink} units={units} />
        </div>
      </details>
    ));
  }
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl" id={headingId}>
          Bücher und Einheiten
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
