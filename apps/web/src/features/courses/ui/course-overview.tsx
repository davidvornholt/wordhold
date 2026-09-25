import type { ReactNode } from 'react';
import { countNoun } from '../../../shared/format/count';
import {
  type CourseOutline,
  type CourseUnit,
  courseTotals,
} from '../schemas/course-units';
import type { CourseBookActions } from './course-book-editor';
import { UnitSection } from './unit-section';

type CourseOverviewProps = CourseBookActions & {
  // Null when the course is named after its language, which would otherwise
  // print the same entry twice under its own heading.
  readonly languageLabel: string | null;
  readonly outline: CourseOutline;
  readonly primaryAction: ReactNode | null;
  // Null when the empty course already leads with importing as its primary
  // action, so the same link is not offered twice.
  readonly importAction: ReactNode | null;
  readonly settingsAction: ReactNode;
  readonly vocabularyAction: ReactNode;
  readonly renderUnitLink: (unit: CourseUnit) => ReactNode;
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
  outline,
  primaryAction,
  importAction,
  settingsAction,
  vocabularyAction,
  renderUnitLink,
  ...actions
}: CourseOverviewProps) => {
  const totals = courseTotals(outline.units);
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
        outline={outline}
        renderUnitLink={renderUnitLink}
        {...actions}
      />
    </>
  );
};
