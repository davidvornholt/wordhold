import { maximumEntriesPerPage } from '@wordhold/ai/extraction/schema';
import { useState } from 'react';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import type { UnitSelectionData } from '../schemas/import-payload';
import type { Unit, UnitEntry } from '../services/repository';
import { BulkUnitAssignment } from './bulk-unit-assignment';
import {
  appendedRow,
  draftFormState,
  type IdentifiedDraftRow,
  identifiedRows,
  rowsWithUnit,
  rowsWithUnitFrom,
  rowWithConfirmation,
  rowWithEntry,
  rowWithGeneratedExample,
  rowWithUnit,
  withoutRow,
} from './draft-rows';
import { type DraftEntry, EntryRow } from './entry-row';
import { EntryUnitAssignment } from './entry-unit-assignment';
import { initialUnitSelection } from './initial-unit-selection';
import {
  entryIsComplete,
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
  readonly generateExample: (
    targetText: string,
    nativeText: string,
  ) => Promise<{ readonly target: string; readonly native: string }>;
  readonly onSubmit: (
    verifiedEntries: ReadonlyArray<VerificationEntry>,
  ) => void;
  readonly submitLabel?: (entryCount: number) => string;
};

export const VerifyForm = ({
  initialEntries,
  initialUnitName,
  existingEntries,
  generateExample,
  targetLabel,
  units,
  busy,
  onSubmit,
  submitLabel = (entryCount) =>
    entryCount === 0
      ? 'Seite abschließen'
      : `${countNoun(entryCount, 'Eintrag', 'Einträge')} importieren`,
}: VerifyFormProps) => {
  const [bulkUnit, setBulkUnit] = useState<UnitSelectionData>(() =>
    initialUnitSelection(units, initialUnitName),
  );
  const [draftEntries, setDraftEntries] = useState<
    ReadonlyArray<IdentifiedDraftRow>
  >(() =>
    identifiedRows(
      initialEntries,
      initialUnitSelection(units, initialUnitName),
    ),
  );

  const formState = draftFormState(draftEntries, units, existingEntries, busy);

  return (
    <form
      aria-busy={busy}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!formState.submittable) {
          return;
        }
        onSubmit(formState.entriesToSubmit);
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
            duplicate={formState.verdicts[index] ?? 'none'}
            duplicateConfirmed={entry.duplicateConfirmed}
            entry={entry}
            entryNumber={index + 1}
            generateExample={generateExample}
            key={entry.rowId}
            onChange={(next) =>
              setDraftEntries((current) => rowWithEntry(current, index, next))
            }
            onDuplicateConfirmedChange={(confirmed) =>
              setDraftEntries((current) =>
                rowWithConfirmation(current, index, confirmed),
              )
            }
            onGeneratedExample={(source, generated) =>
              setDraftEntries((current) =>
                rowWithGeneratedExample(
                  current,
                  entry.rowId,
                  source,
                  generated,
                ),
              )
            }
            onRemove={() =>
              setDraftEntries((current) => withoutRow(current, index))
            }
            targetLabel={targetLabel}
            unitControl={
              <EntryUnitAssignment
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
                selectionComplete={unitSelectionIsComplete(entry.unit)}
                units={units}
              />
            }
          />
        ))}
      </ul>
      {formState.selection.skipped > 0 ? (
        <p className="text-muted-foreground text-sm">
          {skippedSummary(formState.selection.skipped)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={busy || draftEntries.length >= maximumEntriesPerPage}
          onClick={() =>
            setDraftEntries((current) =>
              appendedRow(
                current,
                initialUnitSelection(units, initialUnitName),
              ),
            )
          }
          variant="outline"
        >
          Eintrag hinzufügen
        </Button>
        <Button disabled={!formState.submittable} type="submit">
          {busy
            ? 'Importiere …'
            : submitLabel(
                formState.completionWithoutImport
                  ? 0
                  : formState.selection.entries.length,
              )}
        </Button>
      </div>
    </form>
  );
};
