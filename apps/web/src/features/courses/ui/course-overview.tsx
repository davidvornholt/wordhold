import { type ReactNode, useState } from 'react';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
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
            aria-haspopup="dialog"
            onClick={() => setAdding(true)}
            variant="quiet"
          >
            Vokabel eintragen
          </Button>
        )}
        {vocabularyAction}
        {importAction}
        {settingsAction}
      </div>
      <Dialog
        closable={true}
        closeLabel="Fertig"
        onClose={() => setAdding(false)}
        open={adding && quickEntry !== null}
        title="Vokabel eintragen"
      >
        {quickEntry}
      </Dialog>
      <BookSection
        createBook={createBook}
        outline={outline}
        renderBookLink={renderBookLink}
      />
    </>
  );
};
