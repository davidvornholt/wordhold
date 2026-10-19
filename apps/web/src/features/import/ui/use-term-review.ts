import { useState } from 'react';
import { focusAfterRemoval, useLedgerFocus } from './ledger-focus';
import {
  type TermDraft,
  type TermRemoval,
  type TermRow,
  termReview,
  termRows,
  withAddedTermRow,
  withoutTermRow,
  withRestoredTermRow,
  withTermEdit,
} from './term-draft-rows';

type TermReviewState = {
  readonly rows: ReadonlyArray<TermRow>;
  // The last removed row, until "Rückgängig" or the next row added.
  readonly removal: TermRemoval | null;
};

// The terms of one page of notes while the learner checks them against the
// photo, and what saving them would do.
export const useTermReview = (
  initialTerms: ReadonlyArray<TermDraft>,
  existingTerms: ReadonlyArray<string>,
) => {
  const { formRef, requestFocus } = useLedgerFocus();
  const [state, setState] = useState<TermReviewState>(() => ({
    rows: termRows(initialTerms),
    removal: null,
  }));
  const { rows, removal } = state;

  return {
    formRef,
    rows,
    removal,
    review: termReview(rows, existingTerms),
    // Text edits keep the removal undoable; they do not move rows.
    changeRow: (
      index: number,
      change: Partial<Pick<TermDraft, 'term' | 'definition'>>,
    ) =>
      setState((current) => ({
        ...current,
        rows: withTermEdit(current.rows, index, change),
      })),
    removeRow: (index: number) => {
      const result = withoutTermRow(rows, index);
      setState(result);
      requestFocus(focusAfterRemoval(result.rows, index));
    },
    undoRemoval: () => {
      if (removal === null) {
        return;
      }
      setState({ rows: withRestoredTermRow(rows, removal), removal: null });
      requestFocus({ kind: 'term', rowId: removal.row.rowId });
    },
    appendRow: () => {
      const next = withAddedTermRow(rows);
      const added = next.at(-1);
      setState({ rows: next, removal: null });
      if (added !== undefined) {
        requestFocus({ kind: 'term', rowId: added.rowId });
      }
    },
  };
};

export type TermReviewForm = ReturnType<typeof useTermReview>;
