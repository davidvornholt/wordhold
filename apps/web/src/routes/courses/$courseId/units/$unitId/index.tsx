import { createFileRoute } from '@tanstack/react-router';
import {
  introducedEntries,
  unitOffers,
} from '../../../../../features/courses/schemas/course-units';
import {
  getCourseDirections,
  listCourseUnits,
  listCourseVocabulary,
} from '../../../../../features/courses/services/server-fns';
import { unitProgressSummary } from '../../../../../features/courses/ui/unit-status';
import { VocabularyLibrary } from '../../../../../features/courses/ui/vocabulary-library';
import { getCourse } from '../../../../../features/import/server-fns';
import { countNoun } from '../../../../../shared/format/count';
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

  const offers = unitOffers(unit);
  return (
    <PageLayout backControl={backControl} title={unit.name}>
      <p className="text-muted-foreground text-sm">
        {unitProgressSummary(unit)}
      </p>
      {offers.learn || offers.practice ? (
        <div className="flex flex-wrap items-center gap-4">
          {offers.learn ? (
            <ActionLink
              params={{ courseId: course.id, unitId: unit.id }}
              to="/courses/$courseId/units/$unitId/learn"
            >
              {countNoun(unit.unintroduced, 'Vokabel', 'Vokabeln')} kennenlernen
            </ActionLink>
          ) : null}
          {offers.practice ? (
            <ActionLink
              params={{ courseId: course.id }}
              search={{ unit: unit.id }}
              to="/courses/$courseId/study"
              variant={offers.learn ? 'outline' : 'primary'}
            >
              {countNoun(introducedEntries(unit), 'Vokabel', 'Vokabeln')} üben
            </ActionLink>
          ) : null}
        </div>
      ) : null}
      <h2 className="font-display text-xl">Vokabeln</h2>
      <VocabularyLibrary
        enabledDirections={directions}
        entries={unitEntries}
        initialFilter="all"
        renderStudyAction={(entryIds) => (
          <ActionLink
            params={{ courseId: course.id }}
            search={{ entries: entryIds.join(',') }}
            to="/courses/$courseId/study"
          >
            Frei üben
          </ActionLink>
        )}
        scope="unit"
        targetLanguage={course.targetLanguage}
      />
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
