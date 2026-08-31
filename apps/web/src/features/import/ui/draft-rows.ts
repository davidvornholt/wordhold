import type { UnitSelectionData } from '../schemas/import-payload';
import type { DraftEntry } from './entry-row';
import type { DraftRow } from './verify-form-selection';

const emptyEntry: DraftEntry = {
  targetText: '',
  nativeText: '',
  example: '',
};

// Edited text voids an earlier duplicate confirmation: the consent applied
// to the previous wording.
export const rowWithEntry = (
  rows: ReadonlyArray<DraftRow>,
  index: number,
  entry: DraftEntry,
): ReadonlyArray<DraftRow> =>
  rows.map((row, i) =>
    i === index ? { ...entry, unit: row.unit, duplicateConfirmed: false } : row,
  );

export const rowWithConfirmation = (
  rows: ReadonlyArray<DraftRow>,
  index: number,
  duplicateConfirmed: boolean,
): ReadonlyArray<DraftRow> =>
  rows.map((row, i) => (i === index ? { ...row, duplicateConfirmed } : row));

export const rowWithUnit = (
  rows: ReadonlyArray<DraftRow>,
  index: number,
  unit: UnitSelectionData,
): ReadonlyArray<DraftRow> =>
  rows.map((row, i) => (i === index ? { ...row, unit } : row));

export const rowsWithUnitFrom = (
  rows: ReadonlyArray<DraftRow>,
  index: number,
  unit: UnitSelectionData,
): ReadonlyArray<DraftRow> =>
  rows.map((row, i) => (i >= index ? { ...row, unit } : row));

export const rowsWithUnit = (
  rows: ReadonlyArray<DraftRow>,
  unit: UnitSelectionData,
): ReadonlyArray<DraftRow> => rows.map((row) => ({ ...row, unit }));

export const withoutRow = (
  rows: ReadonlyArray<DraftRow>,
  index: number,
): ReadonlyArray<DraftRow> => rows.filter((_, i) => i !== index);

export const appendedRow = (
  rows: ReadonlyArray<DraftRow>,
  fallbackUnit: UnitSelectionData,
): ReadonlyArray<DraftRow> => [
  ...rows,
  {
    ...emptyEntry,
    unit: rows.at(-1)?.unit ?? fallbackUnit,
    duplicateConfirmed: false,
  },
];
