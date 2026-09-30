import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type ReactNode, useId, useState } from 'react';
import type { CourseSubject } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import type { VocabularyEntry } from '../schemas/course-units';
import type { VocabularyFilter } from '../schemas/vocabulary-search';
import { VocabularyLibrary } from './vocabulary-library';

type SubjectOverviewProps = {
  readonly subject: CourseSubject;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  // The filter shown on arrival, such as the difficult terms the overview
  // links to.
  readonly initialFilter: VocabularyFilter;
  readonly primaryAction: ReactNode | null;
  // The form for a term, saving into this subject.
  readonly entryForm: ReactNode;
  readonly settingsAction: ReactNode;
  readonly renderStudyAction: (
    entryIds: ReadonlyArray<string>,
    intent: 'learn' | 'practice',
  ) => ReactNode;
  readonly renderEntryDetail: (entry: VocabularyEntry) => ReactNode;
};

const subjectSummary = (entries: ReadonlyArray<VocabularyEntry>): string => {
  if (entries.length === 0) {
    return 'Noch keine Begriffe';
  }
  const unintroduced = entries.filter((entry) => !entry.introduced).length;
  return [
    countNoun(entries.length, 'Begriff', 'Begriffe'),
    unintroduced === 0 ? null : `${unintroduced} noch kennenlernen`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
};

// A subject's page is its list of terms: the next thing to do, typing new
// terms, and the list with its search and filters. An empty subject opens
// with the form, since typing its first term is all there is to do.
export const SubjectOverview = ({
  subject,
  entries,
  enabledDirections,
  initialFilter,
  primaryAction,
  entryForm,
  settingsAction,
  renderStudyAction,
  renderEntryDetail,
}: SubjectOverviewProps) => {
  const isEmpty = entries.length === 0;
  const [adding, setAdding] = useState(isEmpty);
  const formId = useId();
  const headingId = useId();
  let nextStep: ReactNode = primaryAction;
  if (primaryAction === null && !isEmpty) {
    nextStep = (
      <p className="min-h-11 content-center text-sm">Für jetzt geschafft</p>
    );
  }
  return (
    <>
      <p className="text-muted-foreground text-sm">{subjectSummary(entries)}</p>
      <div className="flex flex-wrap items-center gap-4">
        {nextStep}
        <Button
          aria-controls={adding ? formId : undefined}
          aria-expanded={adding}
          onClick={() => setAdding((current) => !current)}
          variant="quiet"
        >
          {adding ? 'Fertig' : 'Begriff eintragen'}
        </Button>
        {settingsAction}
      </div>
      {adding ? <div id={formId}>{entryForm}</div> : null}
      {isEmpty ? null : (
        <section aria-labelledby={headingId} className="flex flex-col gap-3">
          <h2 className="font-display text-xl" id={headingId}>
            Begriffe
          </h2>
          <VocabularyLibrary
            enabledDirections={enabledDirections}
            entries={entries}
            initialFilter={initialFilter}
            layout="flat"
            renderEntryDetail={renderEntryDetail}
            renderStudyAction={renderStudyAction}
            subject={subject}
          />
        </section>
      )}
    </>
  );
};
