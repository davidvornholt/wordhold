import type { UnitSelectionData } from '../schemas/import-payload';
import type { Unit, UnitEntry } from '../services/repository';
import { assessDraftDuplicates } from './draft-duplicates';
import type {
  DraftEntry,
  ExampleGenerationSource,
  GeneratedExample,
} from './entry-row';
import {
  canCompleteWithoutImport,
  type DraftRow,
  entriesForSubmission,
  selectImportableEntries,
  unitSelectionIsComplete,
} from './verify-form-selection';

export type IdentifiedDraftRow = DraftRow & {
  readonly rowId: string;
};

const emptyEntry: DraftEntry = {
  targetText: '',
  nativeText: '',
  example: '',
};

export const identifiedRows = (
  entries: ReadonlyArray<DraftEntry>,
  unit: UnitSelectionData,
): ReadonlyArray<IdentifiedDraftRow> =>
  entries.map((entry, index) => ({
    ...entry,
    rowId: `draft-${index}`,
    unit,
    duplicateConfirmed: false,
  }));

export const draftFormState = (
  draftEntries: ReadonlyArray<IdentifiedDraftRow>,
  units: ReadonlyArray<Unit>,
  existingEntries: ReadonlyArray<UnitEntry>,
  busy: boolean,
) => {
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
  return {
    completionWithoutImport,
    entriesToSubmit,
    selection,
    submittable:
      !busy &&
      unitsNamed &&
      (selection.entries.length > 0 || completionWithoutImport),
    verdicts,
  };
};

// Edited text voids an earlier duplicate confirmation: the consent applied
// to the previous wording.
export const rowWithEntry = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  index: number,
  entry: DraftEntry,
): ReadonlyArray<IdentifiedDraftRow> =>
  rows.map((row, rowIndex) =>
    rowIndex === index
      ? {
          ...entry,
          rowId: row.rowId,
          unit: row.unit,
          duplicateConfirmed: false,
        }
      : row,
  );

export const rowWithGeneratedExample = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  rowId: string,
  source: ExampleGenerationSource,
  generated: GeneratedExample,
): ReadonlyArray<IdentifiedDraftRow> =>
  rows.map((row) =>
    row.rowId === rowId &&
    row.targetText.trim() === source.targetText &&
    row.nativeText.trim() === source.nativeText &&
    row.example === source.example
      ? {
          ...row,
          example: generated.target,
          generatedExample: { nativeText: generated.native },
          duplicateConfirmed: false,
        }
      : row,
  );

export const rowWithConfirmation = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  index: number,
  duplicateConfirmed: boolean,
): ReadonlyArray<IdentifiedDraftRow> =>
  rows.map((row, rowIndex) =>
    rowIndex === index ? { ...row, duplicateConfirmed } : row,
  );

export const rowWithUnit = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  index: number,
  unit: UnitSelectionData,
): ReadonlyArray<IdentifiedDraftRow> =>
  rows.map((row, rowIndex) =>
    rowIndex === index ? { ...row, unit, duplicateConfirmed: false } : row,
  );

export const rowsWithUnitFrom = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  index: number,
  unit: UnitSelectionData,
): ReadonlyArray<IdentifiedDraftRow> =>
  rows.map((row, rowIndex) =>
    rowIndex >= index ? { ...row, unit, duplicateConfirmed: false } : row,
  );

export const rowsWithUnit = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  unit: UnitSelectionData,
): ReadonlyArray<IdentifiedDraftRow> =>
  rows.map((row) => ({ ...row, unit, duplicateConfirmed: false }));

export const withoutRow = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  index: number,
): ReadonlyArray<IdentifiedDraftRow> =>
  rows.filter((_, rowIndex) => rowIndex !== index);

export const appendedRow = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  fallbackUnit: UnitSelectionData,
): ReadonlyArray<IdentifiedDraftRow> => [
  ...rows,
  {
    ...emptyEntry,
    rowId: `draft-added-${globalThis.crypto.randomUUID()}`,
    unit: rows.at(-1)?.unit ?? fallbackUnit,
    duplicateConfirmed: false,
  },
];
