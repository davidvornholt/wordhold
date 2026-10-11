import { Button } from '../../../shared/ui/button';
import type { UnitSelectionData } from '../schemas/import-payload';
import type { Unit } from '../services/repository';
import { entryRange } from './entry-range';
import { ledgerGrid } from './ledger-grid';
import { UnitPicker } from './unit-picker';

type LedgerSectionHeadProps = {
  readonly rowId: string;
  readonly start: number;
  readonly end: number;
  readonly unit: UnitSelectionData;
  readonly units: ReadonlyArray<Unit>;
  readonly required: boolean;
  readonly disabled: boolean;
  readonly onChange: (unit: UnitSelectionData) => void;
  readonly onJoin: () => void;
};

// Where the page moves on to another unit, ruled off like a new heading in
// a notebook.
export const LedgerSectionHead = ({
  rowId,
  start,
  end,
  unit,
  units,
  required,
  disabled,
  onChange,
  onJoin,
}: LedgerSectionHeadProps) => (
  <div
    className={`${ledgerGrid} animate-settle border-primary/40 border-t-4 border-double pt-3 pb-1`}
    data-section-start={rowId}
  >
    <p className="col-start-2 hidden self-end pb-2.5 pl-1 font-display text-muted-foreground sm:block">
      {entryRange(start, end)}
    </p>
    <div className="col-start-2 sm:col-start-3 sm:pl-4">
      <UnitPicker
        disabled={disabled}
        label={`Einheit ab Eintrag ${start + 1}`}
        onChange={onChange}
        required={required}
        selection={unit}
        units={units}
      />
    </div>
    <div className="col-start-3 flex items-end justify-end sm:col-start-4">
      <Button
        aria-label={`Einheitenwechsel ab Eintrag ${start + 1} aufheben`}
        className="px-2"
        disabled={disabled}
        onClick={onJoin}
        variant="quiet-muted"
      >
        Aufheben
      </Button>
    </div>
  </div>
);
