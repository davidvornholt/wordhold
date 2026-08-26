import type { ReactNode } from 'react';
import type { CourseUnit } from '../schemas/course-units';

type UnitListProps = {
  readonly units: ReadonlyArray<CourseUnit>;
  // Returns null for a unit this screen has nothing to offer on: a unit with
  // no unmet words has nothing to learn, one with no learned words has
  // nothing to drill.
  readonly renderAction: (unit: CourseUnit) => ReactNode;
  readonly importAction: ReactNode;
};

const unitProgress = (unit: CourseUnit): string =>
  unit.unlearned === 0
    ? `Alle ${unit.words} Wörter gelernt`
    : `${unit.unlearned} von ${unit.words} Wörtern noch nicht gelernt`;

export const UnitList = ({
  units,
  renderAction,
  importAction,
}: UnitListProps) =>
  units.length === 0 ? (
    <div className="flex flex-col gap-3 border border-border bg-card p-6">
      <p className="font-medium">Dieser Kurs hat noch keine Einheiten.</p>
      <p className="text-sm">
        Fotografiere eine Vokabelseite und gib ihr beim Prüfen einen
        Einheitennamen.
      </p>
      {importAction}
    </div>
  ) : (
    <ul className="flex flex-col gap-3">
      {units.map((unit) => (
        <li
          className="flex items-baseline justify-between gap-3 border border-border bg-card p-4"
          key={unit.id}
        >
          <div>
            <p className="font-medium">{unit.name}</p>
            <p className="text-muted-foreground text-sm">
              {unitProgress(unit)}
            </p>
          </div>
          {renderAction(unit)}
        </li>
      ))}
    </ul>
  );
