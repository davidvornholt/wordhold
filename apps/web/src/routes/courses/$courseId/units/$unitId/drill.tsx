import { createFileRoute, Link } from '@tanstack/react-router';
import {
  getCourseDirections,
  listCourseUnits,
} from '../../../../../features/courses/services/server-fns';
import { getCourse } from '../../../../../features/import/server-fns';
import { parsePracticeSearch } from '../../../../../features/practice/schemas/session-request';
import { getUnitDrill } from '../../../../../features/practice/services/server-fns';
import {
  resolveSessionDirection,
  sessionOptions,
} from '../../../../../features/practice/services/session-options';
import { PracticeLayout } from '../../../../../features/practice/ui/practice-layout';
import { SessionRunner } from '../../../../../features/practice/ui/session-runner';
import { SessionStart } from '../../../../../features/practice/ui/session-start';
import { germanLabels } from '../../../../../shared/languages';

const DrillScreen = () => {
  const { course, unit, directions, direction, drill } = Route.useLoaderData();
  const targetLabel = germanLabels[course.targetLanguage];
  const backToCourse = (label: string) => (
    <Link
      className="text-sm underline"
      params={{ courseId: course.id }}
      to="/courses/$courseId"
    >
      {label}
    </Link>
  );

  if (unit === undefined) {
    return (
      <PracticeLayout
        backControl={backToCourse(`← ${course.name}`)}
        title={course.name}
      >
        <div className="flex flex-col gap-3 border border-border bg-card p-6">
          <p className="font-medium">
            Diese Einheit gehört nicht zu diesem Kurs.
          </p>
          {backToCourse('Zurück zum Kurs')}
        </div>
      </PracticeLayout>
    );
  }

  const backToUnit = (label: string) => (
    <Link
      className="text-sm underline"
      params={{ courseId: course.id, unitId: unit.id }}
      to="/courses/$courseId/units/$unitId"
    >
      {label}
    </Link>
  );

  return (
    <PracticeLayout
      backControl={backToUnit(`← ${unit.name}`)}
      title={`${unit.name} üben`}
    >
      {drill === null ? (
        <SessionStart
          options={sessionOptions(directions, targetLabel)}
          renderStartAction={(option) => (
            <Link
              className="w-fit font-medium underline"
              params={{ courseId: course.id, unitId: unit.id }}
              search={{ direction: option.value }}
              to="/courses/$courseId/units/$unitId/drill"
            >
              {option.label}
            </Link>
          )}
        />
      ) : (
        <SessionRunner
          backControl={backToUnit('Zurück zur Einheit')}
          emptyMessage="In dieser Einheit ist noch keine Vokabel gelernt."
          key={direction}
          mode="drill"
          session={drill}
          targetLabel={targetLabel}
        />
      )}
    </PracticeLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/units/$unitId/drill')({
  validateSearch: parsePracticeSearch,
  loaderDeps: ({ search }) => ({ direction: search.direction }),
  // The unit comes from the course's own list, which is what confirms it
  // belongs to this course before any of its cards are asked.
  loader: async ({ params, deps }) => {
    const [course, directions, units] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseDirections({ data: params.courseId }),
      listCourseUnits({ data: params.courseId }),
    ]);
    const unit = units.find((candidate) => candidate.id === params.unitId);
    const direction = resolveSessionDirection(deps.direction, directions);
    const drill =
      unit === undefined || direction === undefined
        ? null
        : await getUnitDrill({ data: { unitId: unit.id, direction } });
    return { course, unit, directions, direction, drill };
  },
  component: DrillScreen,
});
