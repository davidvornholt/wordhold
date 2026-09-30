import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { useId } from 'react';
import type { CourseSubject } from '../../../shared/directions';
import { Checkbox } from '../../../shared/ui/selection-controls';
import { cardListClass } from '../../../shared/ui/surface-styles';
import type { VocabularyEntry } from '../schemas/course-units';
import { VocabularyEntryRow } from './vocabulary-entry-row';

const labelClasses = {
  // Course view: the unit name doubles as section heading and select-all.
  heading: 'flex min-h-11 w-fit items-center gap-3 font-display text-xl',
  // Unit view: a plain "Alle auswählen" control above the flat list.
  plain: 'flex min-h-11 w-fit items-center gap-3 font-medium text-sm',
} as const;

type VocabularyUnitSectionProps = {
  readonly label: string;
  readonly labelStyle: keyof typeof labelClasses;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly now: Date;
  readonly subject: CourseSubject;
  readonly selected: ReadonlyArray<string>;
  readonly onToggleEntry: (entryId: string) => void;
  readonly onOpenEntry: (entryId: string) => void;
  readonly onToggleAll: (
    entryIds: ReadonlyArray<string>,
    select: boolean,
  ) => void;
};

export const VocabularyUnitSection = ({
  label,
  labelStyle,
  entries,
  enabledDirections,
  now,
  subject,
  selected,
  onToggleEntry,
  onOpenEntry,
  onToggleAll,
}: VocabularyUnitSectionProps) => {
  const selectAllId = useId();
  const selectedEntryCount = entries.filter((entry) =>
    selected.includes(entry.id),
  ).length;
  const allSelected =
    entries.length > 0 && selectedEntryCount === entries.length;
  const partiallySelected = selectedEntryCount > 0 && !allSelected;
  return (
    <section className="flex flex-col gap-2">
      <label className={labelClasses[labelStyle]} htmlFor={selectAllId}>
        <Checkbox
          aria-checked={partiallySelected ? 'mixed' : allSelected}
          checked={allSelected}
          disabled={entries.length === 0}
          id={selectAllId}
          indeterminate={partiallySelected}
          onChange={() =>
            onToggleAll(
              entries.map((entry) => entry.id),
              !allSelected,
            )
          }
        />
        {label}
      </label>
      <ul className={cardListClass}>
        {entries.map((entry) => (
          <VocabularyEntryRow
            enabledDirections={enabledDirections}
            entry={entry}
            key={entry.id}
            now={now}
            onOpen={() => onOpenEntry(entry.id)}
            onToggle={() => onToggleEntry(entry.id)}
            selected={selected.includes(entry.id)}
            subject={subject}
          />
        ))}
      </ul>
    </section>
  );
};
