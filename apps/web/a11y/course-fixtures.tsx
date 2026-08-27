import type { UnitWord } from '../src/features/courses/schemas/course-units';
import { learnedWords } from '../src/features/courses/schemas/course-units';
import { CourseLayout } from '../src/features/courses/ui/course-layout';
import { CourseOverview } from '../src/features/courses/ui/course-overview';
import { UnitDetail } from '../src/features/courses/ui/unit-detail';
import { type FixtureState, navigateToFixture } from './fixture-state';

const mixedUnit = {
  id: '00000000-0000-0000-0000-000000000003',
  name: 'Unit 3 – Holidays',
  words: 18,
  unlearned: 2,
};

const freshUnit = {
  id: '00000000-0000-0000-0000-000000000004',
  name: 'Unit 4 – Sport',
  words: 12,
  unlearned: 12,
};

const finishedUnit = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Unit 2 – School',
  words: 16,
  unlearned: 0,
};

const mixedWords: ReadonlyArray<UnitWord> = [
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

const freshWords: ReadonlyArray<UnitWord> = [
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
      units={[mixedUnit, freshUnit, finishedUnit]}
    />
  </CourseLayout>
);

// `fresh` is a unit nobody has met yet, which has words to learn and nothing to
// drill: a drill would have no card to ask.
export const UnitFixture = ({ fresh = false }) => {
  const unit = fresh ? freshUnit : mixedUnit;
  return (
    <CourseLayout
      backControl={control('← English A2', 'course')}
      title={unit.name}
    >
      <UnitDetail
        drillAction={control(`${learnedWords(unit)} üben`, 'drill-start')}
        learnAction={control(`${unit.unlearned} lernen`, 'learn')}
        targetLanguage="en"
        unit={unit}
        words={fresh ? freshWords : mixedWords}
      />
    </CourseLayout>
  );
};
