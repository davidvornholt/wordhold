import { Button } from '../../../shared/ui/button';

type RemovedRowProps = {
  readonly notice: string;
  // The ledger's columns, so the notice lines up with the rows around it.
  readonly grid: string;
  readonly disabled: boolean;
  readonly onUndo: () => void;
};

// Holds the removed entry's place in the ledger until the next removal or
// a change that moves rows, so undoing happens where the eye already is.
export const RemovedRow = ({
  notice,
  grid,
  disabled,
  onUndo,
}: RemovedRowProps) => (
  <li
    className={`${grid} animate-settle border-border border-b border-dashed bg-muted/40`}
  >
    <div className="col-[2/-1] flex flex-wrap items-center gap-x-3 py-1 pl-1 text-muted-foreground text-sm">
      <p className="font-display italic">{notice}</p>
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
