import { maximumUnitNameLength } from '@wordhold/ai/extraction/schema';
import type { KeyboardEventHandler } from 'react';
import { useCallback, useId } from 'react';
import { countNoun } from '../../../shared/format/count';
import { fieldCompactClass } from '../../../shared/ui/field-styles';
import type { UnitSelectionData } from '../schemas/import-payload';
import type { Unit } from '../services/repository';

const newUnitValue = 'new';

type UnitPickerProps = {
  readonly focusOnMount?: boolean;
  readonly units: ReadonlyArray<Unit>;
  readonly selection: UnitSelectionData;
  readonly label: string;
  readonly required: boolean;
  readonly disabled: boolean;
  readonly onNewUnitNameKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  readonly onChange: (selection: UnitSelectionData) => void;
};

export const UnitPicker = ({
  focusOnMount = false,
  units,
  selection,
  label,
  required,
  disabled,
  onNewUnitNameKeyDown,
  onChange,
}: UnitPickerProps) => {
  const selectId = useId();
  const nameId = useId();
  const focusSelectOnMount = useCallback(
    (select: HTMLSelectElement | null) => {
      if (focusOnMount) {
        select?.focus();
      }
    },
    [focusOnMount],
  );

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm" htmlFor={selectId}>
        {label}
        <select
          className={fieldCompactClass}
          disabled={disabled}
          id={selectId}
          onChange={(event) =>
            onChange(
              event.target.value === newUnitValue
                ? { kind: 'new', name: '' }
                : { kind: 'existing', unitId: event.target.value },
            )
          }
          ref={focusSelectOnMount}
          value={
            selection.kind === 'existing' ? selection.unitId : newUnitValue
          }
        >
          <option value={newUnitValue}>Neue Einheit …</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name} ({countNoun(unit.entryCount, 'Vokabel', 'Vokabeln')})
            </option>
          ))}
        </select>
      </label>
      {selection.kind === 'new' ? (
        <label className="flex flex-col gap-1 text-sm" htmlFor={nameId}>
          Name der Einheit
          <input
            className={fieldCompactClass}
            disabled={disabled}
            id={nameId}
            maxLength={maximumUnitNameLength}
            onChange={(event) =>
              onChange({ kind: 'new', name: event.target.value })
            }
            onKeyDown={onNewUnitNameKeyDown}
            placeholder="z. B. Unité 3"
            required={required}
            value={selection.name}
          />
        </label>
      ) : null}
    </div>
  );
};
