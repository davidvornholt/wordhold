import { maximumUnitNameLength } from '@wordhold/ai/extraction/schema';
import { type ReactNode, useId } from 'react';
import { countNoun } from '../../../shared/format/count';
import type { UnitSelectionData } from '../schemas/import-payload';
import type { Unit } from '../services/repository';
import { FilingInput, FilingSelect } from './filing-select';

const noUnitValue = 'none';
const newUnitValue = 'new';

const selectionFromValue = (value: string): UnitSelectionData => {
  if (value === noUnitValue) {
    return { kind: 'none' };
  }
  return value === newUnitValue
    ? { kind: 'new', name: '' }
    : { kind: 'existing', unitId: value };
};

const valueFromSelection = (selection: UnitSelectionData): string => {
  if (selection.kind === 'existing') {
    return selection.unitId;
  }
  return selection.kind === 'new' ? newUnitValue : noUnitValue;
};

type UnitPickerProps = {
  readonly units: ReadonlyArray<Unit>;
  readonly selection: UnitSelectionData;
  readonly label: string;
  // Shown beside the label, outside the select's accessible name.
  readonly detail?: ReactNode;
  readonly required: boolean;
  readonly disabled: boolean;
  readonly onChange: (selection: UnitSelectionData) => void;
};

// The book's units come first, in book order: most pages continue one.
export const UnitPicker = ({
  units,
  selection,
  label,
  detail,
  required,
  disabled,
  onChange,
}: UnitPickerProps) => {
  const selectId = useId();
  const nameId = useId();

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <label className="eyebrow" htmlFor={selectId}>
          {label}
        </label>
        {detail}
      </div>
      <FilingSelect
        disabled={disabled}
        id={selectId}
        onChange={(event) => onChange(selectionFromValue(event.target.value))}
        value={valueFromSelection(selection)}
      >
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name} ({countNoun(unit.entryCount, 'Vokabel', 'Vokabeln')})
          </option>
        ))}
        <option value={newUnitValue}>Neue Einheit …</option>
        <option value={noUnitValue}>Keine Einheit</option>
      </FilingSelect>
      {selection.kind === 'new' ? (
        <div className="mt-2 flex flex-col gap-1">
          <label className="eyebrow" htmlFor={nameId}>
            Name der Einheit
          </label>
          <FilingInput
            disabled={disabled}
            id={nameId}
            maxLength={maximumUnitNameLength}
            onChange={(event) =>
              onChange({ kind: 'new', name: event.target.value })
            }
            placeholder="z. B. Unité 3"
            required={required}
            value={selection.name}
          />
        </div>
      ) : null}
    </div>
  );
};
