import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type ReactNode, useId, useRef, useState } from 'react';
import {
  type CourseNouns,
  type CourseSubject,
  courseNouns,
} from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import { Dialog } from '../../../shared/ui/dialog';
import type { VocabularyEntry } from '../schemas/course-units';
import type { VocabularyFilter } from '../schemas/vocabulary-search';
import type { CourseEntryActions } from './entry-actions';
import { VocabularyLibrary } from './vocabulary-library';

type SubjectOverviewProps = {
  readonly subject: CourseSubject;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  // The filter shown on arrival, such as the difficult entries the overview
  // links to.
  readonly initialFilter: VocabularyFilter;
  readonly primaryAction: ReactNode | null;
  // The form for a term or text, saving into this subject or collection.
  readonly entryForm: ReactNode;
  readonly settingsAction: ReactNode;
  readonly renderStudyAction: (
    entryIds: ReadonlyArray<string>,
    intent: 'learn' | 'practice',
  ) => ReactNode;
  readonly entryActions: CourseEntryActions;
};

const subjectSummary = (
  entries: ReadonlyArray<VocabularyEntry>,
  nouns: CourseNouns,
): string => {
  if (entries.length === 0) {
    return `Noch keine ${nouns.plural}`;
  }
  const unintroduced = entries.filter((entry) => !entry.introduced).length;
  return [
    countNoun(entries.length, nouns.singular, nouns.plural),
    unintroduced === 0 ? null : `${unintroduced} noch kennenlernen`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
};

// A subject's page is its list of terms, a collection's its list of texts:
// the next thing to do, typing new entries, and the list with its search and
// filters. Entries are typed in a dialog that stays open for the next one
// and adds each saved entry to the list behind it. An empty subject leads
// with typing, since its first entry is all there is to do.
export const SubjectOverview = ({
  subject,
  entries,
  enabledDirections,
  initialFilter,
  primaryAction,
  entryForm,
  settingsAction,
  renderStudyAction,
  entryActions,
}: SubjectOverviewProps) => {
  const isEmpty = entries.length === 0;
  const nouns = courseNouns(subject);
  const [adding, setAdding] = useState(false);
  const headingId = useId();
  // Takes focus once an entry is deleted, since its row is gone, and counts
  // the entries that are left.
  const summaryRef = useRef<HTMLParagraphElement>(null);
  let nextStep: ReactNode = primaryAction;
  if (primaryAction === null && !isEmpty) {
    nextStep = (
      <p className="min-h-11 content-center text-sm">Für jetzt geschafft</p>
    );
  }
  return (
    <>
      <p
        className="text-muted-foreground text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        ref={summaryRef}
        tabIndex={-1}
      >
        {subjectSummary(entries, nouns)}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {nextStep}
        <Button
          aria-haspopup="dialog"
          onClick={() => setAdding(true)}
          variant={isEmpty ? 'primary' : 'quiet'}
        >
          {nouns.singular} eintragen
        </Button>
        {settingsAction}
      </div>
      <Dialog
        closable={true}
        closeLabel="Fertig"
        onClose={() => setAdding(false)}
        open={adding}
        title={`${nouns.singular} eintragen`}
      >
        {entryForm}
      </Dialog>
      {isEmpty ? null : (
        <section aria-labelledby={headingId} className="flex flex-col gap-3">
          <h2 className="font-display text-xl" id={headingId}>
            {nouns.plural}
          </h2>
          <VocabularyLibrary
            enabledDirections={enabledDirections}
            entries={entries}
            initialFilter={initialFilter}
            entryActions={entryActions}
            fallbackFocusRef={summaryRef}
            layout="flat"
            renderStudyAction={renderStudyAction}
            subject={subject}
          />
        </section>
      )}
    </>
  );
};
