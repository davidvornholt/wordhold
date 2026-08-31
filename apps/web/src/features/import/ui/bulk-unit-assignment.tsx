import { Button } from '../../../shared/ui/button';
import type { UnitSelectionData } from '../schemas/import-payload';
import type { Unit } from '../services/repository';
import { UnitPicker } from './unit-picker';

type BulkUnitAssignmentProps = {
  readonly units: ReadonlyArray<Unit>;
  readonly selection: UnitSelectionData;
  readonly disabled: boolean;
  readonly canApply: boolean;
  readonly onChange: (selection: UnitSelectionData) => void;
  readonly onApply: () => void;
};

export const BulkUnitAssignment = ({
  units,
  selection,
  disabled,
  canApply,
  onChange,
  onApply,
}: BulkUnitAssignmentProps) => (
  <fieldset className="flex flex-col gap-3 border border-border bg-card p-3">
    <legend className="px-1 font-display text-xl">
      Mehrere Vokabeln zuordnen
    </legend>
    <p className="text-muted-foreground text-sm">
      Wähle eine Einheit für alle Vokabeln. Einzelne Zuordnungen kannst du
      danach ändern.
    </p>
    <UnitPicker
      disabled={disabled}
      label="Einheit für alle Vokabeln"
      onNewUnitNameKeyDown={(event) => {
        if (event.key !== 'Enter') {
          return;
        }
        event.preventDefault();
        if (!disabled && canApply) {
          onApply();
        }
      }}
      onChange={onChange}
      required={false}
      selection={selection}
      units={units}
    />
    <Button
      className="w-fit"
      disabled={disabled || !canApply}
      onClick={onApply}
      variant="outline"
    >
      Auf alle anwenden
    </Button>
  </fieldset>
);
