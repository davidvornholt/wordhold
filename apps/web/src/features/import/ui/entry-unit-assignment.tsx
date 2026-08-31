import { useState } from 'react';
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
  readonly selectionComplete: boolean;
  readonly onChange: (selection: UnitSelectionData) => void;
  readonly onApplyFollowing: () => void;
};

const selectionSummary = (
  units: ReadonlyArray<Unit>,
  selection: UnitSelectionData,
): string =>
  selection.kind === 'existing'
    ? (units.find((unit) => unit.id === selection.unitId)?.name ??
      'Unbekannte Einheit')
    : `${selection.name} (neu)`;

// Most pages file every word into one unit, so each entry shows its unit as a
// quiet summary line and unfolds the picker only on request — or when the
// assignment still needs a unit name and cannot stay as it is.
export const EntryUnitAssignment = ({
  units,
  selection,
  entryNumber,
  hasFollowing,
  required,
  disabled,
  selectionComplete,
  onChange,
  onApplyFollowing,
}: EntryUnitAssignmentProps) => {
  const [pickerRequested, setPickerRequested] = useState(false);
  if (!pickerRequested && selectionComplete) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground text-xs">
        <span>Einheit: {selectionSummary(units, selection)}</span>
        <Button
          aria-label={`Einheit für Eintrag ${entryNumber} ändern`}
          disabled={disabled}
          onClick={() => setPickerRequested(true)}
          variant="quiet-muted"
        >
          Ändern
        </Button>
      </p>
    );
  }
  return (
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
          disabled={disabled || !selectionComplete}
          onClick={onApplyFollowing}
          variant="quiet-muted"
        >
          Ab hier anwenden
        </Button>
      ) : null}
    </div>
  );
};
