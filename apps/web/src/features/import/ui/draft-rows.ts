import {
  awaitsTranslationFor,
  type ExampleGenerationSource,
  type GeneratedExample,
  matchesGenerationSource,
} from '../../../shared/examples/example-draft';
import type { UnitSelectionData } from '../schemas/import-payload';
import type { UnitEntry } from '../services/repository';
import { assessDraftDuplicates } from './draft-duplicates';
import type { DraftEntry } from './entry-row';
import {
  canCompleteWithoutImport,
  type DraftRow,
  entriesForSubmission,
  selectImportableEntries,
  unitSelectionIsComplete,
} from './verify-form-selection';

// A page files its words like the book prints them: in runs that each belong
// to one unit. The row that starts a run names its unit, and every row below
// follows it until the next row that names one. The first row always names
// the page's unit, so a run can never lose its unit.
export type IdentifiedDraftRow = DraftEntry & {
  readonly rowId: string;
  readonly duplicateConfirmed: boolean;
  readonly unitFrom?: UnitSelectionData;
};

export type UnitSection = {
  readonly start: number;
  // One past the section's last row.
  readonly end: number;
  readonly unit: UnitSelectionData;
};

// What "Rückgängig" needs to put a removed row back where it was. A run
// that started at the removed row moved on to the next row.
export type RowRemoval = {
  readonly row: IdentifiedDraftRow;
  readonly index: number;
  readonly unitMovedTo: string | null;
};

const lowConfidence = 0.8;

// The reading was unsure of this row; the learner compares it with the photo.
export const isUncertain = (entry: { readonly confidence?: number }): boolean =>
  entry.confidence !== undefined && entry.confidence < lowConfidence;

const emptyEntry: DraftEntry = {
  targetText: '',
  nativeText: '',
  example: '',
  exampleNativeText: '',
};

const withoutUnitFrom = ({
  unitFrom: _unitFrom,
  ...row
}: IdentifiedDraftRow): IdentifiedDraftRow => row;

export const identifiedRows = (
  entries: ReadonlyArray<DraftEntry>,
  unit: UnitSelectionData,
): ReadonlyArray<IdentifiedDraftRow> =>
  entries.map((entry, index) => ({
    ...entry,
    rowId: `draft-${index}`,
    duplicateConfirmed: false,
    ...(index === 0 ? { unitFrom: unit } : {}),
  }));

export const unitSections = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
): ReadonlyArray<UnitSection> => {
  const sections: Array<UnitSection> = [];
  for (const [index, row] of rows.entries()) {
    const current = sections.at(-1);
    if (current === undefined || row.unitFrom !== undefined) {
      sections.push({
        start: index,
        end: index + 1,
        unit: row.unitFrom ?? { kind: 'none' },
      });
    } else {
      sections[sections.length - 1] = { ...current, end: index + 1 };
    }
  }
  return sections;
};

// Every row with the unit it is filed into, ready for the import payload.
export const filedRows = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
): ReadonlyArray<DraftRow & { readonly rowId: string }> =>
  unitSections(rows).flatMap((section) =>
    rows
      .slice(section.start, section.end)
      .map((row) => ({ ...withoutUnitFrom(row), unit: section.unit })),
  );

export const draftFormState = (
  draftEntries: ReadonlyArray<IdentifiedDraftRow>,
  existingEntries: ReadonlyArray<UnitEntry>,
  busy: boolean,
) => {
  const rows = filedRows(draftEntries);
  const duplicates = assessDraftDuplicates(rows, existingEntries);
  const selection = selectImportableEntries(
    rows,
    duplicates.map((duplicate) => duplicate.verdict),
  );
  const entriesToSubmit = entriesForSubmission(selection);
  const unitsNamed = entriesToSubmit.every((entry) =>
    unitSelectionIsComplete(entry.unit),
  );
  const completionWithoutImport = canCompleteWithoutImport(rows, selection);
  return {
    completionWithoutImport,
    entriesToSubmit,
    selection,
    submittable:
      !busy &&
      unitsNamed &&
      (selection.entries.length > 0 || completionWithoutImport),
    duplicates,
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
          duplicateConfirmed: false,
          ...(row.unitFrom === undefined ? {} : { unitFrom: row.unitFrom }),
        }
      : row,
  );

export const rowWithTranslatedExample = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  rowId: string,
  sentence: string,
  native: string,
): ReadonlyArray<IdentifiedDraftRow> =>
  rows.map((row) =>
    row.rowId === rowId && awaitsTranslationFor(row, sentence)
      ? { ...row, exampleNativeText: native }
      : row,
  );

export const rowWithGeneratedExample = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  rowId: string,
  source: ExampleGenerationSource,
  generated: GeneratedExample,
): ReadonlyArray<IdentifiedDraftRow> =>
  rows.map((row) =>
    row.rowId === rowId && matchesGenerationSource(row, source)
      ? {
          ...row,
          example: generated.target,
          exampleNativeText: generated.native,
          exampleGenerated: true,
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

// A duplicate confirmation was given for the row where it was filed, so
// every row that moves to another unit asks again.
const withConfirmationsCleared = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  start: number,
  end: number,
): ReadonlyArray<IdentifiedDraftRow> =>
  rows.map((row, index) =>
    index >= start && index < end ? { ...row, duplicateConfirmed: false } : row,
  );

const sectionEnd = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  start: number,
): number => {
  const next = rows.findIndex(
    (row, index) => index > start && row.unitFrom !== undefined,
  );
  return next === -1 ? rows.length : next;
};

// Files the row at `index` and the rest of its run into `unit`. On a row
// inside a run, this starts a new run there.
export const rowsWithUnitFrom = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  index: number,
  unit: UnitSelectionData,
): ReadonlyArray<IdentifiedDraftRow> => {
  const named = rows.map((row, rowIndex) =>
    rowIndex === index ? { ...row, unitFrom: unit } : row,
  );
  return withConfirmationsCleared(named, index, sectionEnd(named, index));
};

// Joins the run that starts at `index` to the run above it.
export const rowsWithoutUnitChange = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  index: number,
): ReadonlyArray<IdentifiedDraftRow> => {
  if (index === 0) {
    return rows;
  }
  const end = sectionEnd(rows, index);
  const joined = rows.map((row, rowIndex) =>
    rowIndex === index ? withoutUnitFrom(row) : row,
  );
  return withConfirmationsCleared(joined, index, end);
};

// Another book has other units: the whole page becomes one run again.
export const rowsWithPageUnit = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  unit: UnitSelectionData,
): ReadonlyArray<IdentifiedDraftRow> =>
  rows.map((row, index) => ({
    ...withoutUnitFrom(row),
    duplicateConfirmed: false,
    ...(index === 0 ? { unitFrom: unit } : {}),
  }));

export const withoutRow = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  index: number,
): {
  readonly rows: ReadonlyArray<IdentifiedDraftRow>;
  readonly removal: RowRemoval | null;
} => {
  const row = rows[index];
  if (row === undefined) {
    return { rows, removal: null };
  }
  const next = rows[index + 1];
  const unitMoves =
    row.unitFrom !== undefined &&
    next !== undefined &&
    next.unitFrom === undefined;
  const remaining = rows.flatMap((candidate, rowIndex) => {
    if (rowIndex === index) {
      return [];
    }
    return unitMoves && rowIndex === index + 1
      ? [{ ...candidate, unitFrom: row.unitFrom }]
      : [candidate];
  });
  return {
    rows: remaining,
    removal: {
      row,
      index,
      unitMovedTo: unitMoves && next !== undefined ? next.rowId : null,
    },
  };
};

// Puts a removed row back. A run that moved on to the next row returns to
// the restored row with the unit it has now, so a unit picked after the
// removal survives the undo. The run keeps its unit object until someone
// picks another, so a new object means the restored row changes unit.
export const withRestoredRow = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  removal: RowRemoval,
): ReadonlyArray<IdentifiedDraftRow> => {
  const heir = rows.find((row) => row.rowId === removal.unitMovedTo);
  const restored =
    heir?.unitFrom === undefined
      ? removal.row
      : {
          ...removal.row,
          unitFrom: heir.unitFrom,
          duplicateConfirmed:
            removal.row.duplicateConfirmed &&
            heir.unitFrom === removal.row.unitFrom,
        };
  const withoutHeirUnit = rows.map((row) =>
    row.rowId === heir?.rowId ? withoutUnitFrom(row) : row,
  );
  const index = Math.min(removal.index, withoutHeirUnit.length);
  return [
    ...withoutHeirUnit.slice(0, index),
    restored,
    ...withoutHeirUnit.slice(index),
  ];
};

const addedRowPrefix = 'draft-added-';

// Typed in on the review screen rather than read from the page.
export const rowWasAdded = (row: IdentifiedDraftRow): boolean =>
  row.rowId.startsWith(addedRowPrefix);

// A new row continues the last run; on an emptied page it starts the page's
// run again.
export const appendedRow = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
  pageUnit: UnitSelectionData,
): ReadonlyArray<IdentifiedDraftRow> => [
  ...rows,
  {
    ...emptyEntry,
    rowId: `${addedRowPrefix}${globalThis.crypto.randomUUID()}`,
    duplicateConfirmed: false,
    ...(rows.length === 0 ? { unitFrom: pageUnit } : {}),
  },
];

// Rows that can receive a generated sentence: no sentence yet, both words
// present.
export const rowsWithoutExample = (
  rows: ReadonlyArray<IdentifiedDraftRow>,
): ReadonlyArray<IdentifiedDraftRow> =>
  rows.filter(
    (row) =>
      row.example.trim() === '' &&
      row.targetText.trim() !== '' &&
      row.nativeText.trim() !== '',
  );
