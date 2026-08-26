import type { ReactNode } from 'react';
import type { CourseUnit } from '../schemas/course-units';

type UnitListProps = {
  readonly units: ReadonlyArray<CourseUnit>;
  // The unit's name as a link into the unit itself. The row carries no other
  // control, so opening a unit is the one thing this list does.
  readonly renderUnitLink: (unit: CourseUnit) => ReactNode;
};

const unitProgress = (unit: CourseUnit): string =>
  unit.unlearned === 0
    ? `${unit.words} Wörter · alle gelernt`
    : `${unit.words} Wörter · ${unit.unlearned} noch nicht gelernt`;

export const UnitList = ({ units, renderUnitLink }: UnitListProps) =>
  units.length === 0 ? (
    <p className="border border-border bg-card p-6 text-sm">
      Dieser Kurs hat noch keine Einheiten. Fotografiere eine Vokabelseite und
      gib ihr beim Prüfen einen Einheitennamen.
    </p>
  ) : (
    <ul className="divide-y divide-border border border-border bg-card">
      {units.map((unit) => (
        <li className="flex flex-col gap-1 px-4 py-3" key={unit.id}>
          {renderUnitLink(unit)}
          <span className="text-muted-foreground text-sm">
            {unitProgress(unit)}
          </span>
        </li>
      ))}
    </ul>
  );
