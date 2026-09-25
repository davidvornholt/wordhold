import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { Checkbox } from '../../../shared/ui/selection-controls';
import type { VocabularyEntry } from '../schemas/course-units';
import { VocabularyExample } from './vocabulary-example';
import { VocabularySchedule } from './vocabulary-schedule';

type VocabularyEntryRowProps = {
  readonly entry: VocabularyEntry;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly now: Date;
  readonly targetLanguage: LanguageCode;
  readonly selected: boolean;
  readonly onToggle: () => void;
  readonly generateExample: () => Promise<
    NonNullable<VocabularyEntry['example']>
  >;
};

export const VocabularyEntryRow = ({
  entry,
  enabledDirections,
  now,
  targetLanguage,
  selected,
  onToggle,
  generateExample,
}: VocabularyEntryRowProps) => (
  <li className="flex gap-3 p-4 hover:bg-muted/50">
    <Checkbox
      aria-label={`${entry.targetText} auswählen`}
      checked={selected}
      className="mt-1"
      onChange={onToggle}
    />
    <div className="flex min-w-0 flex-1 flex-col">
      <p>
        <span className="font-medium" lang={targetLanguage}>
          {entry.targetText}
        </span>
        <span className="text-muted-foreground"> · {entry.nativeText}</span>
      </p>
      <VocabularySchedule
        enabledDirections={enabledDirections}
        entry={entry}
        exampleControl={
          <VocabularyExample
            entry={entry}
            generate={generateExample}
            targetLanguage={targetLanguage}
          />
        }
        now={now}
        targetLanguage={targetLanguage}
      />
    </div>
  </li>
);
