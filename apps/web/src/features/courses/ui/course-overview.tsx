import { type ReactNode, useId, useState } from 'react';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import {
  type CourseBook,
  type CourseOutline,
  courseTotals,
} from '../schemas/course-units';
import { BookSection } from './book-section';

type CourseOverviewProps = {
  // Null when the course is named after its language, which would otherwise
  // print the same entry twice under its own heading.
  readonly languageLabel: string | null;
  readonly outline: CourseOutline;
  readonly primaryAction: ReactNode | null;
  // Null when the empty course already leads with importing as its primary
  // action, so the same link is not offered twice.
  readonly importAction: ReactNode | null;
  // Typing a word into any book or unit. Null while the course has no book
  // to put it in.
  readonly quickEntry: ReactNode | null;
  readonly settingsAction: ReactNode;
  readonly vocabularyAction: ReactNode;
  readonly renderBookLink: (book: CourseBook) => ReactNode;
  // Creates a book and opens its page.
  readonly createBook: (name: string) => Promise<void>;
};

const courseSummary = (
  languageLabel: string | null,
  totals: { readonly entries: number; readonly unintroduced: number },
): string =>
  [
    languageLabel,
    countNoun(totals.entries, 'Vokabel', 'Vokabeln'),
    totals.unintroduced === 0
      ? null
      : `${totals.unintroduced} noch kennenlernen`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

// The primary action leads to the most useful next work. Book-specific
// alternatives remain on each book's page.
export const CourseOverview = ({
  languageLabel,
  outline,
  primaryAction,
  importAction,
  quickEntry,
  settingsAction,
  vocabularyAction,
  renderBookLink,
  createBook,
}: CourseOverviewProps) => {
  const [adding, setAdding] = useState(false);
  const quickEntryId = useId();
  const totals = courseTotals(outline);
  return (
    <>
      <p className="text-muted-foreground text-sm">
        {courseSummary(languageLabel, totals)}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {primaryAction ?? (
          <p className="min-h-11 content-center text-sm">Für jetzt geschafft</p>
        )}
        {quickEntry === null ? null : (
          <Button
            aria-controls={adding ? quickEntryId : undefined}
            aria-expanded={adding}
            onClick={() => setAdding((current) => !current)}
            variant="quiet"
          >
            {adding ? 'Fertig' : 'Vokabel eintragen'}
          </Button>
        )}
        {vocabularyAction}
        {importAction}
        {settingsAction}
      </div>
      {adding && quickEntry !== null ? (
        <div id={quickEntryId}>{quickEntry}</div>
      ) : null}
      <BookSection
        createBook={createBook}
        outline={outline}
        renderBookLink={renderBookLink}
      />
    </>
  );
};
