import { maximumEntriesPerPage } from '@wordhold/ai/extraction/schema';
import { PlusIcon } from 'lucide-react';
import { Button } from '../../../shared/ui/button';
import { LedgerColumnHeads } from './ledger-column-heads';
import { termLedgerGrid } from './ledger-grid';
import { termRemovalNotice } from './removal-notice';
import { RemovedRow } from './removed-row';
import { termRowWasAdded } from './term-draft-rows';
import { TermLedgerRow } from './term-row';
import type { TermReviewForm } from './use-term-review';

type TermLedgerProps = {
  readonly form: TermReviewForm;
  readonly busy: boolean;
};

// The page's terms as the notes keep them: one ruled line per term, its
// definition in the right-hand column.
export const TermLedger = ({ form, busy }: TermLedgerProps) => {
  const { rows, removal, review } = form;
  const removedRow =
    removal === null ? null : (
      <RemovedRow
        disabled={busy}
        grid={termLedgerGrid}
        key="removed"
        notice={termRemovalNotice(removal)}
        onUndo={form.undoRemoval}
      />
    );

  return (
    <div className="border border-border bg-card px-2 pt-4 pb-2 sm:px-3">
      <LedgerColumnHeads
        grid={termLedgerGrid}
        left="Begriff"
        right="Erklärung"
      />
      {rows.length === 0 ? (
        <p className="border-border border-b py-4 pl-1 text-muted-foreground text-sm sm:pl-10">
          Diese Seite hat noch keine Begriffe. Füge sie selbst hinzu.
        </p>
      ) : null}
      {rows.length === 0 && removal === null ? null : (
        <ul aria-label="Begriffe">
          {rows.flatMap((row, index) => {
            const termRow = (
              <TermLedgerRow
                added={termRowWasAdded(row)}
                disabled={busy}
                incomplete={review.incomplete.includes(index)}
                key={row.rowId}
                onChange={(change) => form.changeRow(index, change)}
                onRemove={() => form.removeRow(index)}
                repeat={review.repeats[index] ?? { verdict: 'none' }}
                row={row}
                termNumber={index + 1}
              />
            );
            return removal?.index === index ? [removedRow, termRow] : [termRow];
          })}
          {removal?.index === rows.length ? removedRow : null}
        </ul>
      )}
      <Button
        className="w-full justify-start pl-1 sm:pl-10"
        data-ledger-add={true}
        disabled={busy || rows.length >= maximumEntriesPerPage}
        onClick={form.appendRow}
        variant="quiet-muted"
      >
        <PlusIcon aria-hidden={true} className="size-4" />
        Begriff hinzufügen
      </Button>
    </div>
  );
};
