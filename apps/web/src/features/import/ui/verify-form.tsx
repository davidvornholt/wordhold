import { maximumEntriesPerPage } from '@wordhold/ai/extraction/schema';
import { useState } from 'react';
import type { UnitSelectionData } from '../schemas/import-payload';
import type { Unit, UnitEntry } from '../services/repository';
import { BulkUnitAssignment } from './bulk-unit-assignment';
import { assessDraftDuplicates } from './draft-duplicates';
import {
  appendedRow,
  rowsWithUnit,
  rowsWithUnitFrom,
  rowWithConfirmation,
  rowWithEntry,
  rowWithUnit,
  withoutRow,
} from './draft-rows';
import { type DraftEntry, EntryRow } from './entry-row';
import { EntryUnitAssignment } from './entry-unit-assignment';
import { initialUnitSelection } from './initial-unit-selection';
import {
  canCompleteWithoutImport,
  type DraftRow,
  entriesForSubmission,
  entryIsComplete,
  selectImportableEntries,
  skippedSummary,
  unitSelectionIsComplete,
  type VerificationEntry,
} from './verify-form-selection';

type VerifyFormProps = {
  readonly initialEntries: ReadonlyArray<DraftEntry>;
  readonly initialUnitName: string | undefined;
  readonly existingEntries: ReadonlyArray<UnitEntry>;
  readonly targetLabel: string;
  readonly units: ReadonlyArray<Unit>;
  readonly busy: boolean;
  readonly onSubmit: (
    verifiedEntries: ReadonlyArray<VerificationEntry>,
  ) => void;
  readonly submitLabel?: (entryCount: number) => string;
};

const initialDraftRows = (
  entries: ReadonlyArray<DraftEntry>,
  units: ReadonlyArray<Unit>,
  initialUnitName: string | undefined,
): ReadonlyArray<DraftRow> =>
  entries.map((entry) => ({
    ...entry,
    unit: initialUnitSelection(units, initialUnitName),
    duplicateConfirmed: false,
  }));

export const VerifyForm = ({
  initialEntries,
  initialUnitName,
  existingEntries,
  targetLabel,
  units,
  busy,
  onSubmit,
  submitLabel = (entryCount) =>
    entryCount === 0
      ? 'Seite abschließen'
      : `${entryCount} Einträge importieren`,
}: VerifyFormProps) => {
  const [bulkUnit, setBulkUnit] = useState<UnitSelectionData>(() =>
    initialUnitSelection(units, initialUnitName),
  );
  const [draftEntries, setDraftEntries] = useState<ReadonlyArray<DraftRow>>(
    () => initialDraftRows(initialEntries, units, initialUnitName),
  );

  const verdicts = assessDraftDuplicates(draftEntries, units, existingEntries);
  const selection = selectImportableEntries(draftEntries, verdicts);
  const entriesToSubmit = entriesForSubmission(selection);
  const unitsNamed = entriesToSubmit.every((entry) =>
    unitSelectionIsComplete(entry.unit),
  );
  const completionWithoutImport = canCompleteWithoutImport(
    draftEntries,
    selection,
  );
  const submittable =
    !busy &&
    unitsNamed &&
    (selection.entries.length > 0 || completionWithoutImport);

  return (
    <form
      aria-busy={busy}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!submittable) {
          return;
        }
        onSubmit(entriesToSubmit);
      }}
    >
      <BulkUnitAssignment
        canApply={draftEntries.length > 0 && unitSelectionIsComplete(bulkUnit)}
        disabled={busy}
        onApply={() =>
          setDraftEntries((current) => rowsWithUnit(current, bulkUnit))
        }
        onChange={setBulkUnit}
        selection={bulkUnit}
        units={units}
      />
      <ul className="flex flex-col gap-3">
        {draftEntries.map((entry, index) => (
          <EntryRow
            disabled={busy}
            duplicate={verdicts[index] ?? 'none'}
            duplicateConfirmed={entry.duplicateConfirmed}
            entry={entry}
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional edits of one page
            key={index}
            onChange={(next) =>
              setDraftEntries((current) => rowWithEntry(current, index, next))
            }
            onDuplicateConfirmedChange={(confirmed) =>
              setDraftEntries((current) =>
                rowWithConfirmation(current, index, confirmed),
              )
            }
            onRemove={() =>
              setDraftEntries((current) => withoutRow(current, index))
            }
            targetLabel={targetLabel}
            unitControl={
              <EntryUnitAssignment
                canApplyFollowing={unitSelectionIsComplete(entry.unit)}
                disabled={busy}
                entryNumber={index + 1}
                hasFollowing={index < draftEntries.length - 1}
                onApplyFollowing={() =>
                  setDraftEntries((current) =>
                    rowsWithUnitFrom(current, index, entry.unit),
                  )
                }
                onChange={(unit) =>
                  setDraftEntries((current) =>
                    rowWithUnit(current, index, unit),
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
      {selection.skipped > 0 ? (
        <p className="text-muted-foreground text-sm">
          {skippedSummary(selection.skipped)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="border border-input px-3 py-1.5 text-sm"
          disabled={busy || draftEntries.length >= maximumEntriesPerPage}
          onClick={() =>
            setDraftEntries((current) =>
              appendedRow(
                current,
                initialUnitSelection(units, initialUnitName),
              ),
            )
          }
          type="button"
        >
          Eintrag hinzufügen
        </button>
        <button
          className="bg-primary px-4 py-1.5 text-primary-foreground text-sm disabled:opacity-50"
          disabled={!submittable}
          type="submit"
        >
          {busy
            ? 'Importiere …'
            : submitLabel(
                completionWithoutImport ? 0 : selection.entries.length,
              )}
        </button>
      </div>
    </form>
  );
};
