import type { ReactNode } from 'react';
import { countNoun } from '../../../shared/format/count';
import { type CourseUnit, courseTotals } from '../schemas/course-units';
import { UnitSection } from './unit-section';

type CourseOverviewProps = {
  // Null when the course is named after its language, which would otherwise
  // print the same entry twice under its own heading.
  readonly languageLabel: string | null;
  readonly targetLabel: string;
  readonly units: ReadonlyArray<CourseUnit>;
  readonly primaryAction: ReactNode | null;
  // Null when the empty course already leads with importing as its primary
  // action, so the same link is not offered twice.
  readonly importAction: ReactNode | null;
  readonly settingsAction: ReactNode;
  readonly vocabularyAction: ReactNode;
  readonly renderUnitLink: (unit: CourseUnit) => ReactNode;
  readonly createUnit: (name: string) => Promise<ReadonlyArray<CourseUnit>>;
  readonly reorderUnits: (
    unitIds: ReadonlyArray<string>,
  ) => Promise<ReadonlyArray<CourseUnit>>;
};

const courseSummary = (
  languageLabel: string | null,
  totals: { readonly entries: number; readonly unintroduced: number },
): string =>
  [
    languageLabel,
    countNoun(totals.entries, 'Vokabel', 'Vokabeln'),
    totals.unintroduced === 0
      ? null
      : `${totals.unintroduced} noch kennenlernen`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

// The primary action leads to the most useful next work. Unit-specific
// alternatives remain in the list below.
export const CourseOverview = ({
  languageLabel,
  targetLabel,
  units,
  primaryAction,
  importAction,
  settingsAction,
  vocabularyAction,
  renderUnitLink,
  createUnit,
  reorderUnits,
}: CourseOverviewProps) => {
  const totals = courseTotals(units);
  return (
    <>
      <p className="text-muted-foreground text-sm">
        {courseSummary(languageLabel, totals)}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {primaryAction ?? (
          <p className="min-h-11 content-center text-sm">Für jetzt geschafft</p>
        )}
        {vocabularyAction}
        {importAction}
        {settingsAction}
      </div>
      <UnitSection
        createUnit={createUnit}
        renderUnitLink={renderUnitLink}
        reorderUnits={reorderUnits}
        targetLabel={targetLabel}
        units={units}
      />
    </>
  );
};
