import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';
import { introducedEntries } from '../src/features/courses/schemas/course-units';
import { CourseOverview } from '../src/features/courses/ui/course-overview';
import { unitProgressSummary } from '../src/features/courses/ui/unit-status';
import { VocabularyLibrary } from '../src/features/courses/ui/vocabulary-library';
import { countNoun } from '../src/shared/format/count';
import { Button } from '../src/shared/ui/button';
import { PageLayout } from '../src/shared/ui/page-layout';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';

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

export const CourseFixture = ({
  practiceAvailable = true,
}: {
  readonly practiceAvailable?: boolean;
}) => (
  <PageLayout
    backControl={fixtureBackControl('Übersicht', 'dashboard')}
    title="English A2"
  >
    <CourseOverview
      importAction={fixtureControl('Seite fotografieren', 'import', 'quiet')}
      languageLabel="Englisch"
      primaryAction={
        practiceAvailable
          ? fixtureControl('6 Karten üben', 'practice', 'primary')
          : fixtureControl('2 Vokabeln kennenlernen', 'learn', 'primary')
      }
      renderUnitLink={(unit) => fixtureControl(unit.name, 'unit', 'quiet')}
      settingsAction={fixtureControl(
        'Einstellungen',
        'course-settings',
        'quiet',
      )}
      vocabularyAction={fixtureControl('Vokabelliste', 'vocabulary', 'quiet')}
      units={[mixedUnit, unintroducedUnit, finishedUnit, emptyUnit]}
    />
  </PageLayout>
);

const unintroducedEntryIndex = 3;

const unitEntry = (
  index: number,
  target: string,
  native: string,
  introduced: boolean,
): VocabularyEntry => ({
  id: `00000000-0000-0000-0000-00000000003${index}`,
  unitId: mixedUnit.id,
  unitName: mixedUnit.name,
  targetText: target,
  nativeText: native,
  introduced,
  cards: [
    {
      cardId: `00000000-0000-0000-0000-00000000004${index}`,
      direction: 'to_target',
      state: introduced ? 'review' : 'new',
      dueAt: introduced ? new Date('2026-08-28T10:00:00Z') : null,
      introducedAt: introduced ? new Date('2026-08-20T10:00:00Z') : null,
      failures: 0,
    },
  ],
});

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
  mixed: [
    unitEntry(1, 'memory', 'die Erinnerung', true),
    unitEntry(2, 'holiday', 'die Ferien', false),
  ],
  unintroduced: [
    unitEntry(
      unintroducedEntryIndex,
      'the referee',
      'der Schiedsrichter',
      false,
    ),
  ],
  empty: [],
};

// The merged unit screen: progress line, the unit's actions, and its
// vocabulary as one selectable list. An unintroduced unit only offers
// kennenlernen; an empty one offers neither action.
export const UnitFixture = ({ state = 'mixed' }: UnitFixtureProps) => {
  const unit = unitsByState[state];
  return (
    <PageLayout
      backControl={fixtureBackControl('English A2', 'course')}
      title={unit.name}
    >
      <p className="text-muted-foreground text-sm">
        {unitProgressSummary(unit)}
      </p>
      {unit.unintroduced > 0 || introducedEntries(unit) > 0 ? (
        <div className="flex flex-wrap items-center gap-4">
          {unit.unintroduced > 0
            ? fixtureControl(
                `${countNoun(unit.unintroduced, 'Vokabel', 'Vokabeln')} kennenlernen`,
                'learn',
                'primary',
              )
            : null}
          {introducedEntries(unit) > 0
            ? fixtureControl(
                `${countNoun(introducedEntries(unit), 'Vokabel', 'Vokabeln')} üben`,
                'study-start',
                unit.unintroduced > 0 ? 'outline' : 'primary',
              )
            : null}
        </div>
      ) : null}
      <h2 className="font-display text-xl">Vokabeln</h2>
      <VocabularyLibrary
        enabledDirections={['to_target']}
        entries={entriesByState[state]}
        initialFilter="all"
        renderStudyAction={() => (
          <Button onClick={() => navigateToFixture('study-start')}>
            Frei üben
          </Button>
        )}
        scope="unit"
        targetLanguage="en"
      />
    </PageLayout>
  );
};
