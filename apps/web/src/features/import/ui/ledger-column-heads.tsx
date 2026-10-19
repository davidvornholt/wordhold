type LedgerColumnHeadsProps = {
  readonly grid: string;
  readonly left: string;
  readonly right: string;
};

// The ruled heading over a ledger's two text columns. Each field names its
// column for assistive technology, so the heading is visual only.
export const LedgerColumnHeads = ({
  grid,
  left,
  right,
}: LedgerColumnHeadsProps) => (
  <div
    aria-hidden={true}
    className={`${grid} hidden border-primary/40 border-b-4 border-double pb-1.5 sm:grid`}
  >
    <span className="eyebrow col-start-2 pl-1">{left}</span>
    <span className="eyebrow col-start-3 pl-5">{right}</span>
  </div>
);
