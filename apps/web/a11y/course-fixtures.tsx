import type { VocabularyEntry } from '../src/features/courses/schemas/course-units';
import { CourseOverview } from '../src/features/courses/ui/course-overview';
import { UnitDirectionPlan } from '../src/features/courses/ui/unit-direction-plan';
import { unitProgressSummary } from '../src/features/courses/ui/unit-status';
import { UnitVocabularyEmpty } from '../src/features/courses/ui/unit-vocabulary-empty';
import { VocabularyLibrary } from '../src/features/courses/ui/vocabulary-library';
import { directionLabel } from '../src/shared/directions';
import { countNoun } from '../src/shared/format/count';
import { itemsInNextSection } from '../src/shared/session/section-policy';
import { Button } from '../src/shared/ui/button';
import { PageLayout } from '../src/shared/ui/page-layout';
import {
  courseUnits,
  dueUnit,
  emptyUnit,
  mixedUnit,
  targetLabel,
  unintroducedUnit,
} from './course-fixture-data';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';

const coursePrimaryAction = (
  emptyVocabulary: boolean,
  practiceAvailable: boolean,
) => {
  if (emptyVocabulary) {
    return fixtureControl('Seite fotografieren', 'import', 'primary');
  }
  return practiceAvailable
    ? fixtureControl('6 Karten üben', 'practice', 'primary')
    : fixtureControl(
        '2 Vokabeln kennenlernen · Englisch → Deutsch',
        'learn',
        'primary',
      );
};

export const CourseFixture = ({
  emptyVocabulary = false,
  practiceAvailable = true,
}: {
  readonly emptyVocabulary?: boolean;
  readonly practiceAvailable?: boolean;
}) => (
  <PageLayout
    backControl={fixtureBackControl('Übersicht', 'dashboard')}
    title="English A2"
  >
    <CourseOverview
      createUnit={async (name) => [
        ...courseUnits,
        { ...emptyUnit, id: crypto.randomUUID(), name },
      ]}
      importAction={
        emptyVocabulary
          ? null
          : fixtureControl('Seite fotografieren', 'import', 'quiet')
      }
      languageLabel="Englisch"
      primaryAction={coursePrimaryAction(emptyVocabulary, practiceAvailable)}
      renderUnitLink={(unit) => fixtureControl(unit.name, 'unit', 'quiet')}
      reorderUnits={async (unitIds) =>
        unitIds.flatMap((unitId) => {
          const unit = courseUnits.find((candidate) => candidate.id === unitId);
          return unit === undefined ? [] : [unit];
        })
      }
      settingsAction={fixtureControl(
        'Einstellungen',
        'course-settings',
        'quiet',
      )}
      targetLabel={targetLabel}
      vocabularyAction={fixtureControl('Vokabelliste', 'vocabulary', 'quiet')}
      units={emptyVocabulary ? [emptyUnit] : courseUnits}
    />
  </PageLayout>
);

const uuidTailLength = 12;
const entryIdOffset = 100;
const cardIdOffset = 200;

const fixtureId = (offset: number, index: number): string =>
  `00000000-0000-4000-8000-${String(offset + index).padStart(uuidTailLength, '0')}`;

const unitEntry = (
  index: number,
  target: string,
  native: string,
  introduced: boolean,
): VocabularyEntry => ({
  id: fixtureId(entryIdOffset, index),
  unitId: mixedUnit.id,
  unitName: mixedUnit.name,
  targetText: target,
  nativeText: native,
  example: null,
  introduced,
  cards: [
    {
      cardId: fixtureId(cardIdOffset, index),
      direction: 'to_target',
      state: introduced ? 'review' : 'new',
      dueAt: introduced ? new Date('2026-08-28T10:00:00Z') : null,
      introducedAt: introduced ? new Date('2026-08-20T10:00:00Z') : null,
      failures: 0,
    },
  ],
});

type UnitFixtureProps = {
  readonly state?: 'mixed' | 'unintroduced' | 'due' | 'empty';
};

const unitsByState = {
  mixed: mixedUnit,
  unintroduced: unintroducedUnit,
  due: dueUnit,
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
  unintroduced: Array.from({ length: unintroducedUnit.entries }, (_, index) =>
    unitEntry(
      index + 1,
      `new word ${index + 1}`,
      `neues Wort ${index + 1}`,
      false,
    ),
  ),
  due: [unitEntry(1, 'memory', 'die Erinnerung', true)],
  empty: [],
};

// One unit screen holds both learning paths and its selectable vocabulary.
export const UnitFixture = ({ state = 'mixed' }: UnitFixtureProps) => {
  const unit = unitsByState[state];
  return (
    <PageLayout
      backControl={fixtureBackControl('English A2', 'course')}
      title={unit.name}
    >
      <p className="text-muted-foreground text-sm">
        {unitProgressSummary(unit, targetLabel)}
      </p>
      {unit.directions.length === 0 ? null : (
        <UnitDirectionPlan
          renderLearnAction={(progress, variant) =>
            fixtureControl(
              `${countNoun(itemsInNextSection(progress.unintroduced), 'Vokabel', 'Vokabeln')} kennenlernen${variant === 'primary' ? ` · ${directionLabel(progress.direction, targetLabel)}` : ''}`,
              'learn',
              variant,
            )
          }
          renderScheduledAction={(progress, variant) =>
            fixtureControl(
              `${countNoun(progress.due + progress.firstReviews, 'Karte', 'Karten')} üben · ${directionLabel(progress.direction, targetLabel)}`,
              'practice',
              variant,
            )
          }
          targetLabel={targetLabel}
          unit={unit}
        />
      )}
      {entriesByState[state].length === 0 ? (
        <UnitVocabularyEmpty
          importAction={fixtureControl(
            'Seite fotografieren',
            'import',
            'primary',
          )}
        />
      ) : (
        <>
          <h2 className="font-display text-xl">Vokabeln</h2>
          <VocabularyLibrary
            enabledDirections={['to_target', 'to_native']}
            entries={entriesByState[state]}
            generateExample={async () => ({
              targetText: 'This is a useful example.',
              nativeText: 'Das ist ein hilfreiches Beispiel.',
              source: 'generated',
            })}
            initialFilter="all"
            renderStudyAction={(_, intent) => (
              <Button
                onClick={() =>
                  navigateToFixture(
                    intent === 'learn' ? 'learn-start' : 'study-start',
                  )
                }
              >
                Auswahl {intent === 'learn' ? 'kennenlernen' : 'üben'}
              </Button>
            )}
            scope="unit"
            targetLanguage="en"
          />
        </>
      )}
    </PageLayout>
  );
};
