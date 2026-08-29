import type { UnitEntry } from '../src/features/courses/schemas/course-units';
import { learnedEntries } from '../src/features/courses/schemas/course-units';
import { CourseLayout } from '../src/features/courses/ui/course-layout';
import { CourseOverview } from '../src/features/courses/ui/course-overview';
import { UnitDetail } from '../src/features/courses/ui/unit-detail';
import { type FixtureState, navigateToFixture } from './fixture-state';

const mixedUnit = {
  id: '00000000-0000-0000-0000-000000000003',
  name: 'Unit 3 – Holidays',
  entries: 18,
  unlearned: 2,
};

const freshUnit = {
  id: '00000000-0000-0000-0000-000000000004',
  name: 'Unit 4 – Sport',
  entries: 12,
  unlearned: 12,
};

const finishedUnit = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Unit 2 – School',
  entries: 16,
  unlearned: 0,
};

const emptyUnit = {
  id: '00000000-0000-0000-0000-000000000005',
  name: 'Unit 5 – Empty',
  entries: 0,
  unlearned: 0,
};

const mixedEntries: ReadonlyArray<UnitEntry> = [
  {
    id: '00000000-0000-0000-0000-000000000011',
    targetText: 'memory',
    nativeText: 'die Erinnerung',
    learned: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    targetText: 'to look (at)',
    nativeText: 'ansehen',
    learned: false,
  },
];

const freshEntries: ReadonlyArray<UnitEntry> = [
  {
    id: '00000000-0000-0000-0000-000000000013',
    targetText: 'the referee',
    nativeText: 'der Schiedsrichter',
    learned: false,
  },
];

const control = (label: string, destination: FixtureState) => (
  <button
    className="w-fit font-medium text-sm underline"
    onClick={() => navigateToFixture(destination)}
    type="button"
  >
    {label}
  </button>
);

export const CourseFixture = ({
  practiceAvailable = true,
}: {
  readonly practiceAvailable?: boolean;
}) => (
  <CourseLayout
    backControl={control('← Übersicht', 'dashboard')}
    title="English A2"
  >
    <CourseOverview
      importAction={control('Seite fotografieren', 'import')}
      languageLabel="Englisch"
      practiceAvailable={practiceAvailable}
      practiceAction={control('Üben', 'practice')}
      renderUnitLink={(unit) => control(unit.name, 'unit')}
      settingsAction={control('Einstellungen', 'course-settings')}
      units={[mixedUnit, freshUnit, finishedUnit, emptyUnit]}
    />
  </CourseLayout>
);

type UnitFixtureProps = {
  readonly state?: 'mixed' | 'fresh' | 'empty';
};

const unitsByState = {
  mixed: mixedUnit,
  fresh: freshUnit,
  empty: emptyUnit,
} as const;

const entriesByState: Record<
  NonNullable<UnitFixtureProps['state']>,
  ReadonlyArray<UnitEntry>
> = {
  mixed: mixedEntries,
  fresh: freshEntries,
  empty: [],
};

// A fresh unit has entries to learn and nothing to drill. An empty one offers
// neither action.
export const UnitFixture = ({ state = 'mixed' }: UnitFixtureProps) => {
  const unit = unitsByState[state];
  const entries = entriesByState[state];
  return (
    <CourseLayout
      backControl={control('← English A2', 'course')}
      title={unit.name}
    >
      <UnitDetail
        drillAction={control(`${learnedEntries(unit)} üben`, 'drill-start')}
        learnAction={control(`${unit.unlearned} lernen`, 'learn')}
        targetLanguage="en"
        unit={unit}
        entries={entries}
      />
    </CourseLayout>
  );
};
