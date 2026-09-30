import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { ReactNode } from 'react';
import type { CourseSubject } from '../../../shared/directions';
import { Dialog } from '../../../shared/ui/dialog';
import type { VocabularyEntry } from '../schemas/course-units';
import { ScheduleItems } from './vocabulary-schedule';

type VocabularyEntryDetailsProps = {
  readonly entry: VocabularyEntry;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly now: Date;
  readonly subject: CourseSubject;
  // The example sentence of a word, or the key points of a term.
  readonly detail: ReactNode;
};

// What an entry's row leaves out: each direction's schedule and the example
// sentence or key points, which can be changed here.
const VocabularyEntryDetails = ({
  entry,
  enabledDirections,
  now,
  subject,
  detail,
}: VocabularyEntryDetailsProps) => (
  <div className="flex flex-col gap-4 text-sm">
    <dl className="grid gap-3">
      <div className="grid gap-0.5">
        <dt className="font-medium">
          {subject.kind === 'terms' ? 'Definition' : 'Übersetzung'}
        </dt>
        <dd className="hyphens-auto">{entry.nativeText}</dd>
      </div>
      <ScheduleItems
        enabledDirections={enabledDirections}
        entry={entry}
        now={now}
        subject={subject}
      />
    </dl>
    {detail}
  </div>
);

type VocabularyEntryDialogProps = {
  // Undefined while no entry's details are open.
  readonly entry: VocabularyEntry | undefined;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly now: Date;
  readonly subject: CourseSubject;
  readonly renderDetail: (entry: VocabularyEntry) => ReactNode;
  readonly onClose: () => void;
};

// One entry's details over its list, titled with the word or term.
export const VocabularyEntryDialog = ({
  entry,
  enabledDirections,
  now,
  subject,
  renderDetail,
  onClose,
}: VocabularyEntryDialogProps) => (
  <Dialog
    closable={true}
    closeLabel="Schließen"
    onClose={onClose}
    open={entry !== undefined}
    title={
      <span
        lang={subject.kind === 'terms' ? undefined : subject.targetLanguage}
      >
        {entry?.targetText}
      </span>
    }
  >
    {entry === undefined ? null : (
      <VocabularyEntryDetails
        detail={renderDetail(entry)}
        enabledDirections={enabledDirections}
        entry={entry}
        key={entry.id}
        now={now}
        subject={subject}
      />
    )}
  </Dialog>
);
