import { Button } from '../../../shared/ui/button';
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
      <Button
        aria-label={`Einheit ab Vokabel ${entryNumber} anwenden`}
        className="w-fit"
        disabled={disabled || !canApplyFollowing}
        onClick={onApplyFollowing}
        variant="quiet-muted"
      >
        Ab hier anwenden
      </Button>
    ) : null}
  </div>
);
