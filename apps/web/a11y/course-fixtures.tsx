import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';
import { introducedEntries } from '../src/features/courses/schemas/course-units';
import { CourseLayout } from '../src/features/courses/ui/course-layout';
import { CourseOverview } from '../src/features/courses/ui/course-overview';
import { UnitDetail } from '../src/features/courses/ui/unit-detail';
import { type FixtureState, navigateToFixture } from './fixture-state';

const mixedUnit = {
  id: '00000000-0000-0000-0000-000000000003',
  name: 'Unit 3 – Holidays',
  entries: 18,
  unintroduced: 2,
  due: 4,
  firstReviews: 2,
  nextDueAt: new Date('2026-08-30T10:40:00Z'),
};

const unintroducedUnit = {
  id: '00000000-0000-0000-0000-000000000004',
  name: 'Unit 4 – Sport',
  entries: 12,
  unintroduced: 12,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
};

const finishedUnit = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Unit 2 – School',
  entries: 16,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: new Date('2026-08-30T10:40:00Z'),
};

const emptyUnit = {
  id: '00000000-0000-0000-0000-000000000005',
  name: 'Unit 5 – Empty',
  entries: 0,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
};

const cards = (introduced: boolean) => [
  {
    cardId: `00000000-0000-0000-0000-${introduced ? '000000000021' : '000000000023'}`,
    direction: 'to_target' as const,
    state: 'new' as const,
    dueAt: null,
    introducedAt: introduced ? new Date('2026-08-28T10:00:00Z') : null,
    lastReviewedAt: null,
    failures: 0,
    recentReviews: [],
  },
  {
    cardId: `00000000-0000-0000-0000-${introduced ? '000000000022' : '000000000024'}`,
    direction: 'to_native' as const,
    state: 'new' as const,
    dueAt: null,
    introducedAt: introduced ? new Date('2026-08-28T10:00:00Z') : null,
    lastReviewedAt: null,
    failures: 0,
    recentReviews: [],
  },
];

const mixedEntries: ReadonlyArray<VocabularyEntry> = [
  {
    id: '00000000-0000-0000-0000-000000000011',
    unitId: mixedUnit.id,
    unitName: mixedUnit.name,
    targetText: 'memory',
    nativeText: 'die Erinnerung',
    introduced: true,
    cards: cards(true),
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    unitId: mixedUnit.id,
    unitName: mixedUnit.name,
    targetText: 'to look (at)',
    nativeText: 'ansehen',
    introduced: false,
    cards: cards(false),
  },
];

const unintroducedEntries: ReadonlyArray<VocabularyEntry> = [
  {
    id: '00000000-0000-0000-0000-000000000013',
    unitId: unintroducedUnit.id,
    unitName: unintroducedUnit.name,
    targetText: 'the referee',
    nativeText: 'der Schiedsrichter',
    introduced: false,
    cards: cards(false),
  },
];

const control = (label: string, destination: FixtureState) => (
  <button
    className={
      destination === 'practice' || destination === 'study-start'
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

const entriesByState: Record<
  NonNullable<UnitFixtureProps['state']>,
  ReadonlyArray<VocabularyEntry>
> = {
  mixed: mixedEntries,
  unintroduced: unintroducedEntries,
  empty: [],
};

// An unintroduced unit only offers kennenlernen. An empty one offers neither
// action.
export const UnitFixture = ({ state = 'mixed' }: UnitFixtureProps) => {
  const unit = unitsByState[state];
  const entries = entriesByState[state];
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
        targetLanguage="en"
        unit={unit}
        entries={entries}
      />
    </CourseLayout>
  );
};
