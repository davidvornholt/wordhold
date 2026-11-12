import { useId, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { Checkbox } from '../../../shared/ui/selection-controls';
import { cardListClass } from '../../../shared/ui/surface-styles';
import {
  type EntryGroup,
  entryGroups,
  type PickableEntry,
} from './exam-figures';

type ExamWordPickerProps = {
  readonly entries: ReadonlyArray<PickableEntry>;
  // A subject or collection is one list and is shown open, without groups.
  readonly grouped: boolean;
  readonly selected: ReadonlySet<string>;
  readonly onChange: (selected: ReadonlySet<string>) => void;
};

const toggled = (
  selected: ReadonlySet<string>,
  entryIds: ReadonlyArray<string>,
  select: boolean,
): ReadonlySet<string> => {
  const next = new Set(selected);
  for (const entryId of entryIds) {
    if (select) {
      next.add(entryId);
    } else {
      next.delete(entryId);
    }
  }
  return next;
};

// Whole units are picked with one box; single words are added or left out
// after opening the unit.
export const ExamWordPicker = ({
  entries,
  grouped,
  selected,
  onChange,
}: ExamWordPickerProps) => {
  const groups = grouped
    ? entryGroups(entries)
    : [{ key: 'all', label: 'Alle auswählen', entries }];
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <EntryGroupSection
          alwaysOpen={!grouped}
          group={group}
          key={group.key}
          onToggle={(entryIds, select) =>
            onChange(toggled(selected, entryIds, select))
          }
          selected={selected}
        />
      ))}
    </div>
  );
};

type EntryGroupSectionProps = {
  readonly group: EntryGroup;
  readonly alwaysOpen: boolean;
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (entryIds: ReadonlyArray<string>, select: boolean) => void;
};

const EntryGroupSection = ({
  group,
  alwaysOpen,
  selected,
  onToggle,
}: EntryGroupSectionProps) => {
  const selectAllId = useId();
  const listId = useId();
  const [opened, setOpened] = useState(false);
  const open = alwaysOpen || opened;
  const selectedCount = group.entries.filter((entry) =>
    selected.has(entry.id),
  ).length;
  const allSelected = selectedCount === group.entries.length;
  const partiallySelected = selectedCount > 0 && !allSelected;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <label
          className="flex min-h-11 items-center gap-3 font-medium"
          htmlFor={selectAllId}
        >
          <Checkbox
            aria-checked={partiallySelected ? 'mixed' : allSelected}
            checked={allSelected}
            id={selectAllId}
            indeterminate={partiallySelected}
            onChange={() =>
              onToggle(
                group.entries.map((entry) => entry.id),
                !allSelected,
              )
            }
          />
          <span>
            {group.label}{' '}
            <span className="font-normal text-muted-foreground text-sm">
              {selectedCount} von {group.entries.length}
            </span>
          </span>
        </label>
        {alwaysOpen ? null : (
          <Button
            aria-controls={listId}
            aria-expanded={open}
            onClick={() => setOpened(!opened)}
            variant="quiet-muted"
          >
            {open ? 'Einklappen' : 'Einzeln wählen'}
            <span className="sr-only"> ({group.label})</span>
          </Button>
        )}
      </div>
      {open ? (
        <ul className={cardListClass} id={listId}>
          {group.entries.map((entry) => (
            <EntryOption
              entry={entry}
              key={entry.id}
              onToggle={() => onToggle([entry.id], !selected.has(entry.id))}
              selected={selected.has(entry.id)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
};

const EntryOption = ({
  entry,
  selected,
  onToggle,
}: {
  readonly entry: PickableEntry;
  readonly selected: boolean;
  readonly onToggle: () => void;
}) => {
  const id = useId();
  return (
    <li>
      <label className="flex min-h-11 items-start gap-3 px-4 py-3" htmlFor={id}>
        <Checkbox
          checked={selected}
          className="mt-0.5"
          id={id}
          onChange={onToggle}
        />
        <span className="flex min-w-0 flex-col">
          <span className="break-words font-medium">{entry.targetText}</span>
          <span className="line-clamp-2 break-words text-muted-foreground text-sm">
            {entry.nativeText}
          </span>
        </span>
      </label>
    </li>
  );
};
