import type { ReactNode } from 'react';
import { cardClass, cardListClass } from '../../../shared/ui/surface-styles';
import type { CourseUnit } from '../schemas/course-units';
import { unitProgressSummary } from './unit-status';

type UnitListProps = {
  readonly units: ReadonlyArray<CourseUnit>;
  // The unit's name as a link into the unit itself. The row carries no other
  // control, so opening a unit is the one thing this list does.
  readonly renderUnitLink: (unit: CourseUnit) => ReactNode;
};

export const UnitList = ({ units, renderUnitLink }: UnitListProps) =>
  units.length === 0 ? (
    <p className={`${cardClass} text-sm`}>
      Dieser Kurs hat noch keine Einheiten. Fotografiere eine Vokabelseite und
      gib ihr beim Prüfen einen Einheitennamen.
    </p>
  ) : (
    <ul className={cardListClass}>
      {units.map((unit) => (
        <li
          className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/50"
          key={unit.id}
        >
          {renderUnitLink(unit)}
          <span className="text-muted-foreground text-sm">
            {unitProgressSummary(unit)}
          </span>
        </li>
      ))}
    </ul>
  );
