import { type ReactNode, useId, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import type { CourseUnit } from '../schemas/course-units';
import { UnitList } from './unit-list';
import { UnitOrderEditor } from './unit-order-editor';

type UnitSectionProps = {
  readonly units: ReadonlyArray<CourseUnit>;
  readonly targetLabel: string;
  readonly renderUnitLink: (unit: CourseUnit) => ReactNode;
  readonly createUnit: (name: string) => Promise<ReadonlyArray<CourseUnit>>;
  readonly reorderUnits: (
    expectedUnitIds: ReadonlyArray<string>,
    unitIds: ReadonlyArray<string>,
  ) => Promise<ReadonlyArray<CourseUnit>>;
};

export const UnitSection = ({
  units,
  targetLabel,
  renderUnitLink,
  createUnit,
  reorderUnits,
}: UnitSectionProps) => {
  const [editing, setEditing] = useState(false);
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl" id={headingId}>
          Einheiten
        </h2>
        <Button
          aria-expanded={editing}
          onClick={() => setEditing((current) => !current)}
          variant="quiet-muted"
        >
          {editing ? 'Fertig' : 'Bearbeiten'}
        </Button>
      </div>
      {editing ? (
        <UnitOrderEditor
          createUnit={createUnit}
          initialUnits={units}
          reorderUnits={reorderUnits}
        />
      ) : (
        <UnitList
          renderUnitLink={renderUnitLink}
          targetLabel={targetLabel}
          units={units}
        />
      )}
    </section>
  );
};
