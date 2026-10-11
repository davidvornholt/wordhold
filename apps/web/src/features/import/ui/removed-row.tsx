import { Button } from '../../../shared/ui/button';
import type { RowRemoval } from './draft-rows';
import { ledgerGrid } from './ledger-grid';
import { removalNotice } from './removal-notice';

type RemovedRowProps = {
  readonly removal: RowRemoval;
  readonly disabled: boolean;
  readonly onUndo: () => void;
};

// Holds the removed entry's place in the ledger until the next removal or
// a change that moves rows, so undoing happens where the eye already is.
export const RemovedRow = ({ removal, disabled, onUndo }: RemovedRowProps) => (
  <li
    className={`${ledgerGrid} animate-settle border-border border-b border-dashed bg-muted/40`}
  >
    <div className="col-[2/-1] flex flex-wrap items-center gap-x-3 py-1 pl-1 text-muted-foreground text-sm">
      <p className="font-display italic">{removalNotice(removal)}</p>
      <Button
        className="px-1"
        disabled={disabled}
        onClick={onUndo}
        variant="quiet"
      >
        Rückgängig
      </Button>
    </div>
  </li>
);
