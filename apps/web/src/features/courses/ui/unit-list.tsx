import type { ReactNode } from 'react';
import { cardListClass } from '../../../shared/ui/surface-styles';
import type { CourseUnit } from '../schemas/course-units';
import { progressSummary } from './progress-status';

type UnitListProps = {
  readonly units: ReadonlyArray<CourseUnit>;
  // The unit's name as a link into the unit itself. The row carries no other
  // control, so opening a unit is the one thing this list does.
  readonly renderUnitLink: (unit: CourseUnit) => ReactNode;
};

export const UnitList = ({ units, renderUnitLink }: UnitListProps) => (
  <ul className={cardListClass}>
    {units.map((unit) => (
      <li
        className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/50"
        key={unit.id}
      >
        {renderUnitLink(unit)}
        <span className="text-muted-foreground text-sm">
          {progressSummary(unit)}
        </span>
      </li>
    ))}
  </ul>
);
