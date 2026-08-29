import type { ReactNode } from 'react';
import { type CourseUnit, courseTotals } from '../schemas/course-units';
import { UnitList } from './unit-list';

type CourseOverviewProps = {
  // Null when the course is named after its language, which would otherwise
  // print the same entry twice under its own heading.
  readonly languageLabel: string | null;
  readonly units: ReadonlyArray<CourseUnit>;
  readonly practiceAvailable: boolean;
  readonly practiceAction: ReactNode;
  readonly importAction: ReactNode;
  readonly settingsAction: ReactNode;
  readonly renderUnitLink: (unit: CourseUnit) => ReactNode;
};

const courseSummary = (
  languageLabel: string | null,
  totals: { readonly entries: number; readonly unlearned: number },
): string =>
  [
    languageLabel,
    `${totals.entries} Vokabeln`,
    totals.unlearned === 0 ? null : `${totals.unlearned} noch nicht gelernt`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

// Learning and drilling start from a unit, not from here: both ask about one
// unit's entries, and picking the unit is what the list below is for.
export const CourseOverview = ({
  languageLabel,
  units,
  practiceAvailable,
  practiceAction,
  importAction,
  settingsAction,
  renderUnitLink,
}: CourseOverviewProps) => {
  const totals = courseTotals(units);
  return (
    <>
      <p className="text-muted-foreground text-sm">
        {courseSummary(languageLabel, totals)}
      </p>
      <div className="flex flex-wrap gap-4">
        {practiceAvailable ? practiceAction : null}
        {importAction}
        {settingsAction}
      </div>
      <h2 className="font-display text-xl">Einheiten</h2>
      <UnitList renderUnitLink={renderUnitLink} units={units} />
    </>
  );
};
