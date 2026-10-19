import { useState } from 'react';
import type {
  ExampleGenerationSource,
  GeneratedExample,
} from '../../../shared/examples/example-draft';
import type {
  BookSelectionData,
  UnitSelectionData,
} from '../schemas/import-payload';
import type { Book, Unit, UnitEntry } from '../services/repository';
import {
  appendedRow,
  draftFormState,
  type IdentifiedDraftRow,
  identifiedRows,
  type RowRemoval,
  rowsWithoutUnitChange,
  rowsWithPageUnit,
  rowsWithUnitFrom,
  rowWithConfirmation,
  rowWithEntry,
  rowWithGeneratedExample,
  rowWithTranslatedExample,
  unitSections,
  withoutRow,
  withRestoredRow,
} from './draft-rows';
import type { DraftEntry } from './entry-row';
import {
  bookChanged,
  bookSelectionIsComplete,
  initialBookSelection,
  selectedBookName,
  unitsInBook,
} from './initial-book-selection';
import { initialUnitSelection } from './initial-unit-selection';
import { focusAfterRemoval, useLedgerFocus } from './ledger-focus';

type DraftState = {
  readonly rows: ReadonlyArray<IdentifiedDraftRow>;
  // The last removed row, until "Rückgängig" or a change that moves rows.
  readonly removal: RowRemoval | null;
};

// A page that changes unit midway usually moves on to the book's next unit.
// The holding unit for unsorted words is never that next unit.
const followingUnit = (
  units: ReadonlyArray<Unit>,
  unit: UnitSelectionData,
): UnitSelectionData => {
  const realUnits = units.filter((candidate) => !candidate.isHolding);
  const position =
    unit.kind === 'existing'
      ? realUnits.findIndex((candidate) => candidate.id === unit.unitId)
      : -1;
  const next = position === -1 ? undefined : realUnits[position + 1];
  return next === undefined
    ? { kind: 'new', name: '' }
    : { kind: 'existing', unitId: next.id };
};

type DraftFormInput = {
  readonly initialEntries: ReadonlyArray<DraftEntry>;
  readonly initialUnitName: string | undefined;
  readonly books: ReadonlyArray<Book>;
  readonly units: ReadonlyArray<Unit>;
  readonly existingEntries: ReadonlyArray<UnitEntry>;
  readonly busy: boolean;
};

// The ledger's state: its rows, the runs of rows filed into one unit, and
// the last removal. The rows offer only the chosen book's units, so picking
// another book files the whole page into that book's most likely unit again.
export const useDraftForm = ({
  initialEntries,
  initialUnitName,
  books,
  units,
  existingEntries,
  busy,
}: DraftFormInput) => {
  const { formRef, requestFocus } = useLedgerFocus();
  const [book, setBook] = useState<BookSelectionData>(() =>
    initialBookSelection(books),
  );
  const bookUnits = unitsInBook(units, book);
  const pageUnit = (selection: BookSelectionData): UnitSelectionData =>
    initialUnitSelection(
      unitsInBook(units, selection),
      initialUnitName,
      selectedBookName(books, selection),
    );
  const [draft, setDraft] = useState<DraftState>(() => ({
    rows: identifiedRows(initialEntries, pageUnit(book)),
    removal: null,
  }));
  // Text edits keep the removal undoable; they do not move rows.
  const editRows = (
    change: (
      rows: ReadonlyArray<IdentifiedDraftRow>,
    ) => ReadonlyArray<IdentifiedDraftRow>,
  ) => setDraft((current) => ({ ...current, rows: change(current.rows) }));
  const restructure = (
    change: (
      rows: ReadonlyArray<IdentifiedDraftRow>,
    ) => ReadonlyArray<IdentifiedDraftRow>,
  ) => setDraft((current) => ({ rows: change(current.rows), removal: null }));

  const { rows, removal } = draft;
  const formState = draftFormState(rows, existingEntries, busy);

  return {
    formRef,
    book,
    bookUnits,
    rows,
    sections: unitSections(rows),
    removal,
    formState: {
      ...formState,
      submittable: formState.submittable && bookSelectionIsComplete(book),
    },
    changeBook: (next: BookSelectionData) => {
      setBook(next);
      if (bookChanged(book, next)) {
        const unit = pageUnit(next);
        restructure((current) => rowsWithPageUnit(current, unit));
      }
    },
    changeEntry: (index: number, entry: DraftEntry) =>
      editRows((current) => rowWithEntry(current, index, entry)),
    confirmDuplicate: (index: number, confirmed: boolean) =>
      editRows((current) => rowWithConfirmation(current, index, confirmed)),
    applyGeneratedExample: (
      rowId: string,
      source: ExampleGenerationSource,
      generated: GeneratedExample,
    ) =>
      editRows((current) =>
        rowWithGeneratedExample(current, rowId, source, generated),
      ),
    applyTranslatedExample: (rowId: string, sentence: string, native: string) =>
      editRows((current) =>
        rowWithTranslatedExample(current, rowId, sentence, native),
      ),
    // Picking a unit for a run keeps the removal: undo restores the row into
    // the unit its run has now.
    changeSectionUnit: (start: number, unit: UnitSelectionData) =>
      editRows((current) => rowsWithUnitFrom(current, start, unit)),
    startUnit: (index: number, sectionUnit: UnitSelectionData) => {
      const row = rows[index];
      if (row === undefined) {
        return;
      }
      restructure((current) =>
        rowsWithUnitFrom(current, index, followingUnit(bookUnits, sectionUnit)),
      );
      requestFocus({ kind: 'unit', rowId: row.rowId });
    },
    joinUnit: (index: number) => {
      const row = rows[index];
      if (row === undefined) {
        return;
      }
      restructure((current) => rowsWithoutUnitChange(current, index));
      requestFocus({ kind: 'split', rowId: row.rowId });
    },
    removeRow: (index: number) => {
      const result = withoutRow(rows, index);
      setDraft(result);
      requestFocus(focusAfterRemoval(result.rows, index));
    },
    undoRemoval: () => {
      if (removal === null) {
        return;
      }
      setDraft({ rows: withRestoredRow(rows, removal), removal: null });
      requestFocus({ kind: 'term', rowId: removal.row.rowId });
    },
    appendRow: () => {
      const next = appendedRow(rows, pageUnit(book));
      const added = next.at(-1);
      restructure(() => next);
      if (added !== undefined) {
        requestFocus({ kind: 'term', rowId: added.rowId });
      }
    },
  };
};

export type DraftForm = ReturnType<typeof useDraftForm>;
