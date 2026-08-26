import type { ReactNode } from 'react';
import type { LearnableUnit } from '../schemas/learning-models';

type UnitListProps = {
  readonly units: ReadonlyArray<LearnableUnit>;
  readonly renderLearnAction: (unit: LearnableUnit) => ReactNode;
  readonly importAction: ReactNode;
};

const unitProgress = (unit: LearnableUnit): string =>
  unit.unlearned === 0
    ? `Alle ${unit.words} Wörter gelernt`
    : `${unit.unlearned} von ${unit.words} Wörtern noch nicht gelernt`;

export const UnitList = ({
  units,
  renderLearnAction,
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
          {unit.unlearned === 0 ? null : renderLearnAction(unit)}
        </li>
      ))}
    </ul>
  );
