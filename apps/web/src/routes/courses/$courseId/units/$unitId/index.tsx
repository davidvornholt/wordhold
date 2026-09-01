import { createFileRoute } from '@tanstack/react-router';
import {
  generateVocabularyExample,
  getCourseDirections,
  listCourseUnits,
  listCourseVocabulary,
} from '../../../../../features/courses/services/server-fns';
import { UnitDirectionPlan } from '../../../../../features/courses/ui/unit-direction-plan';
import { unitProgressSummary } from '../../../../../features/courses/ui/unit-status';
import { UnitVocabularyEmpty } from '../../../../../features/courses/ui/unit-vocabulary-empty';
import { VocabularyLibrary } from '../../../../../features/courses/ui/vocabulary-library';
import { getCourse } from '../../../../../features/import/server-fns';
import { directionLabel } from '../../../../../shared/directions';
import { countNoun } from '../../../../../shared/format/count';
import { germanLabels } from '../../../../../shared/languages';
import { readyCardsInNextSection } from '../../../../../shared/practice/session-policy';
import { itemsInNextSection } from '../../../../../shared/session/section-policy';
import { ActionLink } from '../../../../../shared/ui/action-link';
import { BackLink } from '../../../../../shared/ui/back-link';
import { PageLayout } from '../../../../../shared/ui/page-layout';
import { cardClass } from '../../../../../shared/ui/surface-styles';

// One screen per unit: progress, the unit's actions, and its vocabulary as a
// selectable list — no separate filtered Vokabelliste to jump to.
const UnitScreen = () => {
  const { course, directions, unit, unitEntries } = Route.useLoaderData();
  const backControl = (
    <BackLink params={{ courseId: course.id }} to="/courses/$courseId">
      {course.name}
    </BackLink>
  );

  if (unit === undefined) {
    return (
      <PageLayout backControl={backControl} title={course.name}>
        <p className={`${cardClass} font-medium`}>
          Diese Einheit gehört nicht zu diesem Kurs.
        </p>
      </PageLayout>
    );
  }

  const targetLabel = germanLabels[course.targetLanguage];
  return (
    <PageLayout backControl={backControl} title={unit.name}>
      <p className="text-muted-foreground text-sm">
        {unitProgressSummary(unit, targetLabel)}
      </p>
      {unit.directions.length === 0 ? null : (
        <UnitDirectionPlan
          renderLearnAction={(progress, variant) => (
            <ActionLink
              className="w-full sm:w-fit"
              params={{ courseId: course.id, unitId: unit.id }}
              search={{ direction: progress.direction }}
              to="/courses/$courseId/units/$unitId/learn"
              variant={variant}
            >
              {`${countNoun(
                itemsInNextSection(progress.unintroduced),
                'Vokabel',
                'Vokabeln',
              )} kennenlernen${
                variant === 'primary'
                  ? ` · ${directionLabel(progress.direction, targetLabel)}`
                  : ''
              }`}
            </ActionLink>
          )}
          renderScheduledAction={(progress, variant) => (
            <ActionLink
              className="w-full sm:w-fit"
              params={{ courseId: course.id }}
              search={{ direction: progress.direction, unit: unit.id }}
              to="/courses/$courseId/practice"
              variant={variant}
            >
              {countNoun(
                readyCardsInNextSection(progress.due, progress.firstReviews),
                'Karte',
                'Karten',
              )}{' '}
              üben · {directionLabel(progress.direction, targetLabel)}
            </ActionLink>
          )}
          targetLabel={targetLabel}
          unit={unit}
        />
      )}
      {unitEntries.length === 0 ? (
        <UnitVocabularyEmpty
          importAction={
            <ActionLink
              params={{ courseId: course.id }}
              to="/courses/$courseId/import"
            >
              Seite fotografieren
            </ActionLink>
          }
        />
      ) : (
        <>
          <h2 className="font-display text-xl">Vokabeln</h2>
          <VocabularyLibrary
            enabledDirections={directions}
            entries={unitEntries}
            generateExample={(entryId) =>
              generateVocabularyExample({ data: entryId })
            }
            initialFilter="all"
            renderStudyAction={(entryIds, intent) => (
              <ActionLink
                params={{ courseId: course.id }}
                search={
                  entryIds.length === unitEntries.length
                    ? { mode: intent, unit: unit.id }
                    : { entries: entryIds.join(','), mode: intent }
                }
                to="/courses/$courseId/study"
              >
                Auswahl {intent === 'learn' ? 'kennenlernen' : 'üben'}
              </ActionLink>
            )}
            scope="unit"
            targetLanguage={course.targetLanguage}
          />
        </>
      )}
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/units/$unitId/')({
  // The unit comes from the course's own list, which is what confirms it
  // belongs to this course before its entries are read.
  loader: async ({ params }) => {
    const [course, units, directions, entries] = await Promise.all([
      getCourse({ data: params.courseId }),
      listCourseUnits({ data: params.courseId }),
      getCourseDirections({ data: params.courseId }),
      listCourseVocabulary({ data: params.courseId }),
    ]);
    const unit = units.find((candidate) => candidate.id === params.unitId);
    return {
      course,
      directions,
      unit,
      unitEntries: entries.filter((entry) => entry.unitId === params.unitId),
    };
  },
  component: UnitScreen,
});
