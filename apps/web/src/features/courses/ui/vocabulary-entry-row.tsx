import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type CourseSubject, isListCourse } from '../../../shared/directions';
import { Checkbox } from '../../../shared/ui/selection-controls';
import type { VocabularyEntry } from '../schemas/course-units';
import { listItemNameClass } from './list-item-name-styles';
import { scheduleSummary } from './vocabulary-schedule-status';

type VocabularyEntryRowProps = {
  readonly entry: VocabularyEntry;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly now: Date;
  readonly subject: CourseSubject;
  readonly selected: boolean;
  readonly onToggle: () => void;
  // Opens the entry's details over the list.
  readonly onOpen: () => void;
};

// A word and its translation share one line. A term's definition is a
// sentence or two, so it gets a line of its own under the term and keeps its
// line breaks. A text can be long, so its row starts it and its details show
// all of it. The word, term or title opens the entry's details.
export const VocabularyEntryRow = ({
  entry,
  enabledDirections,
  now,
  subject,
  selected,
  onToggle,
  onOpen,
}: VocabularyEntryRowProps) => {
  const name = (
    <button
      aria-haspopup="dialog"
      className={listItemNameClass}
      lang={isListCourse(subject.kind) ? undefined : subject.targetLanguage}
      onClick={onOpen}
      type="button"
    >
      {entry.targetText}
    </button>
  );
  return (
    <li className="flex gap-3 p-4 hover:bg-muted/50">
      <Checkbox
        aria-label={`${entry.targetText} auswählen`}
        checked={selected}
        className="mt-1"
        onChange={onToggle}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {isListCourse(subject.kind) ? (
          <>
            {name}
            <p
              className={
                subject.kind === 'texts'
                  ? 'line-clamp-2 hyphens-auto text-muted-foreground'
                  : 'hyphens-auto whitespace-pre-line text-muted-foreground'
              }
            >
              {entry.nativeText}
            </p>
          </>
        ) : (
          <p>
            {name}
            <span className="text-muted-foreground"> · {entry.nativeText}</span>
          </p>
        )}
        <p className="text-muted-foreground text-sm">
          {scheduleSummary(entry, enabledDirections, now)}
        </p>
      </div>
    </li>
  );
};
