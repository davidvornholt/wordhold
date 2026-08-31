import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
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
  readonly targetLanguage: LanguageCode;
  readonly selected: ReadonlyArray<string>;
  readonly onToggleEntry: (entryId: string) => void;
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
  targetLanguage,
  selected,
  onToggleEntry,
  onToggleAll,
}: VocabularyUnitSectionProps) => {
  const selectable = entries.filter((entry) => entry.introduced);
  const allSelected =
    selectable.length > 0 &&
    selectable.every((entry) => selected.includes(entry.id));
  return (
    <section className="flex flex-col gap-2">
      <label className={labelClasses[labelStyle]}>
        <input
          checked={allSelected}
          className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          disabled={selectable.length === 0}
          onChange={() =>
            onToggleAll(
              selectable.map((entry) => entry.id),
              !allSelected,
            )
          }
          type="checkbox"
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
            onToggle={() => onToggleEntry(entry.id)}
            selected={selected.includes(entry.id)}
            targetLanguage={targetLanguage}
          />
        ))}
      </ul>
    </section>
  );
};
