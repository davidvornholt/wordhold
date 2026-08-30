import { maximumEntriesPerPage } from '@wordhold/ai/extraction/schema';
import { useState } from 'react';
import type { UnitSelectionData } from '../schemas/import-payload';
import type { Unit } from '../services/repository';
import { BulkUnitAssignment } from './bulk-unit-assignment';
import { type DraftEntry, EntryRow } from './entry-row';
import { EntryUnitAssignment } from './entry-unit-assignment';
import { initialUnitSelection } from './initial-unit-selection';

const emptyEntry: DraftEntry = {
  targetText: '',
  nativeText: '',
  example: '',
};

type VerifyFormProps = {
  readonly initialEntries: ReadonlyArray<DraftEntry>;
  readonly initialUnitName: string | undefined;
  readonly targetLabel: string;
  readonly units: ReadonlyArray<Unit>;
  readonly busy: boolean;
  readonly onSubmit: (
    verifiedEntries: ReadonlyArray<VerificationEntry>,
  ) => void;
  readonly submitLabel?: (entryCount: number) => string;
};

export type VerificationEntry = DraftEntry & {
  readonly unit: UnitSelectionData;
};

const entryIsComplete = (entry: DraftEntry): boolean =>
  entry.targetText.trim() !== '' && entry.nativeText.trim() !== '';

const unitSelectionIsComplete = (selection: UnitSelectionData): boolean =>
  selection.kind === 'existing' || selection.name.trim() !== '';

export const VerifyForm = ({
  initialEntries,
  initialUnitName,
  targetLabel,
  units,
  busy,
  onSubmit,
  submitLabel = (entryCount) => `${entryCount} Einträge importieren`,
}: VerifyFormProps) => {
  const [bulkUnit, setBulkUnit] = useState<UnitSelectionData>(() =>
    initialUnitSelection(units, initialUnitName),
  );
  const [draftEntries, setDraftEntries] = useState<
    ReadonlyArray<VerificationEntry>
  >(() =>
    initialEntries.map((entry) => ({
      ...entry,
      unit: initialUnitSelection(units, initialUnitName),
    })),
  );

  const complete = draftEntries.filter(entryIsComplete);
  const unitsNamed = complete.every((entry) =>
    unitSelectionIsComplete(entry.unit),
  );

  return (
    <form
      aria-busy={busy}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || complete.length === 0 || !unitsNamed) {
          return;
        }
        onSubmit(complete);
      }}
    >
      <BulkUnitAssignment
        canApply={draftEntries.length > 0 && unitSelectionIsComplete(bulkUnit)}
        disabled={busy}
        onApply={() =>
          setDraftEntries((current) =>
            current.map((entry) => ({ ...entry, unit: bulkUnit })),
          )
        }
        onChange={setBulkUnit}
        selection={bulkUnit}
        units={units}
      />
      <ul className="flex flex-col gap-3">
        {draftEntries.map((entry, index) => (
          <EntryRow
            disabled={busy}
            entry={entry}
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional edits of one page
            key={index}
            onChange={(next) =>
              setDraftEntries((currentEntries) =>
                currentEntries.map((current, i) =>
                  i === index ? { ...next, unit: current.unit } : current,
                ),
              )
            }
            onRemove={() =>
              setDraftEntries((current) =>
                current.filter((_, i) => i !== index),
              )
            }
            targetLabel={targetLabel}
            unitControl={
              <EntryUnitAssignment
                canApplyFollowing={unitSelectionIsComplete(entry.unit)}
                disabled={busy}
                entryNumber={index + 1}
                hasFollowing={index < draftEntries.length - 1}
                onApplyFollowing={() =>
                  setDraftEntries((currentEntries) =>
                    currentEntries.map((current, i) =>
                      i >= index ? { ...current, unit: entry.unit } : current,
                    ),
                  )
                }
                onChange={(unit) =>
                  setDraftEntries((currentEntries) =>
                    currentEntries.map((current, i) =>
                      i === index ? { ...current, unit } : current,
                    ),
                  )
                }
                required={entryIsComplete(entry)}
                selection={entry.unit}
                units={units}
              />
            }
          />
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="border border-input px-3 py-1.5 text-sm"
          disabled={busy || draftEntries.length >= maximumEntriesPerPage}
          onClick={() =>
            setDraftEntries((current) => [
              ...current,
              {
                ...emptyEntry,
                unit:
                  current.at(-1)?.unit ??
                  initialUnitSelection(units, initialUnitName),
              },
            ])
          }
          type="button"
        >
          Eintrag hinzufügen
        </button>
        <button
          className="bg-primary px-4 py-1.5 text-primary-foreground text-sm disabled:opacity-50"
          disabled={busy || complete.length === 0 || !unitsNamed}
          type="submit"
        >
          {busy ? 'Importiere …' : submitLabel(complete.length)}
        </button>
      </div>
    </form>
  );
};
