import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { VocabularyEntry } from '../schemas/course-units';
import { VocabularySchedule } from './vocabulary-schedule';

type VocabularyEntryRowProps = {
  readonly entry: VocabularyEntry;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly now: Date;
  readonly targetLanguage: LanguageCode;
  readonly selected: boolean;
  readonly onToggle: () => void;
};

export const VocabularyEntryRow = ({
  entry,
  enabledDirections,
  now,
  targetLanguage,
  selected,
  onToggle,
}: VocabularyEntryRowProps) => (
  <li className="flex gap-3 p-4 hover:bg-muted/50">
    <input
      aria-label={`${entry.targetText} auswählen`}
      checked={selected}
      className="mt-1 size-5 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      disabled={!entry.introduced}
      onChange={onToggle}
      type="checkbox"
    />
    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 sm:items-start">
      <p>
        <span className="font-medium" lang={targetLanguage}>
          {entry.targetText}
        </span>
        <span className="text-muted-foreground"> · {entry.nativeText}</span>
      </p>
      <VocabularySchedule
        enabledDirections={enabledDirections}
        entry={entry}
        now={now}
        targetLanguage={targetLanguage}
      />
    </div>
  </li>
);
