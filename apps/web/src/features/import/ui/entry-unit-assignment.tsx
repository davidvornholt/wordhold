import type { UnitSelectionData } from '../schemas/import-payload';
import type { Unit } from '../services/repository';
import { UnitPicker } from './unit-picker';

type EntryUnitAssignmentProps = {
  readonly units: ReadonlyArray<Unit>;
  readonly selection: UnitSelectionData;
  readonly entryNumber: number;
  readonly hasFollowing: boolean;
  readonly required: boolean;
  readonly disabled: boolean;
  readonly canApplyFollowing: boolean;
  readonly onChange: (selection: UnitSelectionData) => void;
  readonly onApplyFollowing: () => void;
};

export const EntryUnitAssignment = ({
  units,
  selection,
  entryNumber,
  hasFollowing,
  required,
  disabled,
  canApplyFollowing,
  onChange,
  onApplyFollowing,
}: EntryUnitAssignmentProps) => (
  <div className="flex flex-col gap-2">
    <UnitPicker
      disabled={disabled}
      label={`Einheit für Eintrag ${entryNumber}`}
      onChange={onChange}
      required={required}
      selection={selection}
      units={units}
    />
    {hasFollowing ? (
      <button
        aria-label={`Einheit ab Vokabel ${entryNumber} anwenden`}
        className="w-fit text-muted-foreground text-sm underline"
        disabled={disabled || !canApplyFollowing}
        onClick={onApplyFollowing}
        type="button"
      >
        Ab hier anwenden
      </button>
    ) : null}
  </div>
);
