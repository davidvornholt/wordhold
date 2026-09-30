import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { ReactNode } from 'react';
import type { CourseSubject } from '../../../shared/directions';
import { Checkbox } from '../../../shared/ui/selection-controls';
import type { VocabularyEntry } from '../schemas/course-units';
import { VocabularySchedule } from './vocabulary-schedule';

type VocabularyEntryRowProps = {
  readonly entry: VocabularyEntry;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly now: Date;
  readonly subject: CourseSubject;
  readonly selected: boolean;
  readonly onToggle: () => void;
  readonly detail: ReactNode;
};

// A word and its translation share one line. A term's definition is a
// sentence or two, so it gets a line of its own under the term.
export const VocabularyEntryRow = ({
  entry,
  enabledDirections,
  now,
  subject,
  selected,
  onToggle,
  detail,
}: VocabularyEntryRowProps) => (
  <li className="flex gap-3 p-4 hover:bg-muted/50">
    <Checkbox
      aria-label={`${entry.targetText} auswählen`}
      checked={selected}
      className="mt-1"
      onChange={onToggle}
    />
    <div className="flex min-w-0 flex-1 flex-col">
      {subject.kind === 'terms' ? (
        <>
          <p className="font-medium">{entry.targetText}</p>
          <p className="hyphens-auto text-muted-foreground">
            {entry.nativeText}
          </p>
        </>
      ) : (
        <p>
          <span className="font-medium" lang={subject.targetLanguage}>
            {entry.targetText}
          </span>
          <span className="text-muted-foreground"> · {entry.nativeText}</span>
        </p>
      )}
      <VocabularySchedule
        detail={detail}
        enabledDirections={enabledDirections}
        entry={entry}
        now={now}
        subject={subject}
      />
    </div>
  </li>
);
