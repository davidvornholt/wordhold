import { type ReactNode, useId, useState } from 'react';
import {
  type CourseNouns,
  type CourseSubject,
  courseNouns,
} from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import {
  type CourseBook,
  type CourseOutline,
  courseTotals,
} from '../schemas/course-units';
import { BookSection } from './book-section';

type CourseOverviewProps = {
  readonly subject: CourseSubject;
  // Null for a subject, and when the course is named after its language,
  // which would otherwise print the same entry twice under its own heading.
  readonly languageLabel: string | null;
  readonly outline: CourseOutline;
  // Null when nothing is due and nothing is left to learn, and for an empty
  // subject, which starts with typing its first term.
  readonly primaryAction: ReactNode | null;
  // Null for a subject, which is typed rather than photographed, and when
  // the empty course already leads with importing as its primary action, so
  // the same link is not offered twice.
  readonly importAction: ReactNode | null;
  // Typing an entry into any book or unit. Null while the course has no book
  // to put it in.
  readonly quickEntry: ReactNode | null;
  readonly settingsAction: ReactNode;
  readonly vocabularyAction: ReactNode;
  readonly renderBookLink: (book: CourseBook) => ReactNode;
  // Creates a book and opens its page.
  readonly createBook: (name: string) => Promise<void>;
};

// Worded like a book's summary, so an empty course reads "Noch keine
// Begriffe" or "Englisch · noch keine Vokabeln".
const courseSummary = (
  languageLabel: string | null,
  nouns: CourseNouns,
  totals: { readonly entries: number; readonly unintroduced: number },
): string => {
  const summary = [
    languageLabel,
    totals.entries === 0
      ? `noch keine ${nouns.plural}`
      : countNoun(totals.entries, nouns.singular, nouns.plural),
    totals.unintroduced === 0
      ? null
      : `${totals.unintroduced} noch kennenlernen`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
  return `${summary.charAt(0).toUpperCase()}${summary.slice(1)}`;
};

// The primary action leads to the most useful next work. Book-specific
// alternatives remain on each book's page. An empty course with nothing to
// do but type opens with the entry form, and says nothing about being done.
export const CourseOverview = ({
  subject,
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
  const totals = courseTotals(outline);
  const startsWithTyping = totals.entries === 0 && primaryAction === null;
  const [adding, setAdding] = useState(startsWithTyping);
  const quickEntryId = useId();
  const nouns = courseNouns(subject);
  let nextStep: ReactNode = primaryAction;
  if (nextStep === null && !startsWithTyping) {
    nextStep = (
      <p className="min-h-11 content-center text-sm">Für jetzt geschafft</p>
    );
  }
  return (
    <>
      <p className="text-muted-foreground text-sm">
        {courseSummary(languageLabel, nouns, totals)}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {nextStep}
        {quickEntry === null ? null : (
          <Button
            aria-controls={adding ? quickEntryId : undefined}
            aria-expanded={adding}
            onClick={() => setAdding((current) => !current)}
            variant="quiet"
          >
            {adding ? 'Fertig' : `${nouns.singular} eintragen`}
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
        subject={subject}
      />
    </>
  );
};
