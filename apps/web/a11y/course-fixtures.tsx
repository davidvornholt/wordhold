import { introducedEntries } from '../src/features/courses/schemas/course-units';
import { CourseLayout } from '../src/features/courses/ui/course-layout';
import { CourseOverview } from '../src/features/courses/ui/course-overview';
import { UnitDetail } from '../src/features/courses/ui/unit-detail';
import { type FixtureState, navigateToFixture } from './fixture-state';

const mixedUnit = {
  id: '00000000-0000-0000-0000-000000000003',
  name: 'Unit 3 – Holidays',
  entries: 18,
  introduced: 16,
  unintroduced: 2,
  due: 4,
  firstReviews: 2,
  nextDueAt: new Date('2026-08-30T10:40:00Z'),
};

const unintroducedUnit = {
  id: '00000000-0000-0000-0000-000000000004',
  name: 'Unit 4 – Sport',
  entries: 12,
  introduced: 0,
  unintroduced: 12,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
};

const finishedUnit = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Unit 2 – School',
  entries: 16,
  introduced: 16,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: new Date('2026-08-30T10:40:00Z'),
};

const emptyUnit = {
  id: '00000000-0000-0000-0000-000000000005',
  name: 'Unit 5 – Empty',
  entries: 0,
  introduced: 0,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
};

const control = (label: string, destination: FixtureState) => (
  <button
    className={
      destination === 'practice' || destination === 'learn'
        ? 'inline-flex min-h-11 w-fit items-center bg-primary px-4 py-2 font-medium text-primary-foreground text-sm'
        : 'w-fit font-medium text-sm underline'
    }
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
      primaryAction={
        practiceAvailable
          ? control('6 Karten üben', 'practice')
          : control('2 Vokabeln kennenlernen', 'learn')
      }
      renderUnitLink={(unit) => control(unit.name, 'unit')}
      settingsAction={control('Einstellungen', 'course-settings')}
      vocabularyAction={control('Vokabelliste', 'vocabulary')}
      units={[mixedUnit, unintroducedUnit, finishedUnit, emptyUnit]}
    />
  </CourseLayout>
);

type UnitFixtureProps = {
  readonly state?: 'mixed' | 'unintroduced' | 'empty';
};

const unitsByState = {
  mixed: mixedUnit,
  unintroduced: unintroducedUnit,
  empty: emptyUnit,
} as const;

// An unintroduced unit only offers kennenlernen. An empty one offers neither
// action.
export const UnitFixture = ({ state = 'mixed' }: UnitFixtureProps) => {
  const unit = unitsByState[state];
  return (
    <CourseLayout
      backControl={control('← English A2', 'course')}
      title={unit.name}
    >
      <UnitDetail
        practiceAction={control(
          `${introducedEntries(unit)} Vokabeln üben`,
          'study-start',
        )}
        learnAction={control(`${unit.unintroduced} kennenlernen`, 'learn')}
        unit={unit}
        vocabularyAction={control('Vokabelliste dieser Einheit', 'vocabulary')}
      />
    </CourseLayout>
  );
};
