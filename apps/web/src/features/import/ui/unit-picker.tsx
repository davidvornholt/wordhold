import { useId } from 'react';
import {
  maximumUnitNameLength,
  type UnitSelectionData,
} from '../schemas/import-payload';
import type { Unit } from '../services/repository';

const newUnitValue = 'new';

type UnitPickerProps = {
  readonly units: ReadonlyArray<Unit>;
  readonly selection: UnitSelectionData;
  readonly disabled: boolean;
  readonly onChange: (selection: UnitSelectionData) => void;
};

export const UnitPicker = ({
  units,
  selection,
  disabled,
  onChange,
}: UnitPickerProps) => {
  const selectId = useId();
  const nameId = useId();

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm" htmlFor={selectId}>
        Einheit
        <select
          className="border border-input bg-card px-2 py-1.5"
          disabled={disabled}
          id={selectId}
          onChange={(event) =>
            onChange(
              event.target.value === newUnitValue
                ? { kind: 'new', name: '' }
                : { kind: 'existing', unitId: event.target.value },
            )
          }
          value={
            selection.kind === 'existing' ? selection.unitId : newUnitValue
          }
        >
          <option value={newUnitValue}>Neue Einheit …</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name} ({unit.entryCount} Wörter)
            </option>
          ))}
        </select>
      </label>
      {selection.kind === 'new' ? (
        <label className="flex flex-col gap-1 text-sm" htmlFor={nameId}>
          Name der Einheit
          <input
            className="border border-input bg-card px-2 py-1.5"
            disabled={disabled}
            id={nameId}
            maxLength={maximumUnitNameLength}
            onChange={(event) =>
              onChange({ kind: 'new', name: event.target.value })
            }
            placeholder="z. B. Unité 3"
            required={true}
            value={selection.name}
          />
        </label>
      ) : null}
    </div>
  );
};
