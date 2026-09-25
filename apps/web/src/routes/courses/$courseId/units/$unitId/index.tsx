import { createFileRoute, useRouter } from '@tanstack/react-router';
import {
  createVocabularyEntry,
  generateVocabularyDraftExample,
  generateVocabularyExample,
  getCourseDirections,
  getCourseOutline,
  listCourseVocabulary,
  suggestVocabularyTranslation,
  translateVocabularyDraftExample,
} from '../../../../../features/courses/services/server-fns';
import { UnitDirectionPlan } from '../../../../../features/courses/ui/unit-direction-plan';
import { unitProgressSummary } from '../../../../../features/courses/ui/unit-status';
import { UnitVocabulary } from '../../../../../features/courses/ui/unit-vocabulary';
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
  const { book, course, courseEntries, directions, unit, unitEntries } =
    Route.useLoaderData();
  const router = useRouter();
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
        {book === undefined
          ? unitProgressSummary(unit, targetLabel)
          : `${book.name} · ${unitProgressSummary(unit, targetLabel)}`}
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
      <UnitVocabulary
        createEntry={async (draft) => {
          const created = await createVocabularyEntry({
            data: { courseId: course.id, unitId: unit.id, ...draft },
          });
          await router.invalidate();
          return created;
        }}
        courseEntries={courseEntries}
        enabledDirections={directions}
        entries={unitEntries}
        generateDraftExample={(targetText, nativeText) =>
          generateVocabularyDraftExample({
            data: { courseId: course.id, targetText, nativeText },
          })
        }
        generateExample={(entryId) =>
          generateVocabularyExample({ data: entryId })
        }
        importAction={
          <ActionLink
            params={{ courseId: course.id }}
            to="/courses/$courseId/import"
          >
            Seite fotografieren
          </ActionLink>
        }
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
        suggestTranslation={(text, given) =>
          suggestVocabularyTranslation({
            data: { courseId: course.id, unitId: unit.id, text, given },
          })
        }
        targetLabel={targetLabel}
        targetLanguage={course.targetLanguage}
        translateDraftExample={(targetText) =>
          translateVocabularyDraftExample({
            data: { courseId: course.id, targetText },
          })
        }
      />
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/units/$unitId/')({
  // The unit comes from the course's own list, which is what confirms it
  // belongs to this course before its entries are read.
  loader: async ({ params }) => {
    const [course, outline, directions, entries] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseOutline({ data: params.courseId }),
      getCourseDirections({ data: params.courseId }),
      listCourseVocabulary({ data: params.courseId }),
    ]);
    const unit = outline.units.find(
      (candidate) => candidate.id === params.unitId,
    );
    return {
      book: outline.books.find((candidate) => candidate.id === unit?.bookId),
      course,
      courseEntries: entries,
      directions,
      unit,
      unitEntries: entries.filter((entry) => entry.unitId === params.unitId),
    };
  },
  component: UnitScreen,
});
