import { createFileRoute, Link } from '@tanstack/react-router';
import { getCourse } from '../../../features/import/server-fns';
import { listLearnableUnits } from '../../../features/learning/services/server-fns';
import { LearningLayout } from '../../../features/learning/ui/learning-layout';
import { UnitList } from '../../../features/learning/ui/unit-list';

const LearnUnitsScreen = () => {
  const { course, units } = Route.useLoaderData();

  return (
    <LearningLayout
      backControl={
        <Link className="text-muted-foreground text-sm underline" to="/">
          ← Übersicht
        </Link>
      }
      title={`${course.name}: Lernen`}
    >
      <UnitList
        importAction={
          <Link
            className="w-fit text-sm underline"
            params={{ courseId: course.id }}
            to="/courses/$courseId/import"
          >
            Seite fotografieren
          </Link>
        }
        renderLearnAction={(unit) => (
          <Link
            className="whitespace-nowrap font-medium text-sm underline"
            params={{ courseId: course.id, unitId: unit.id }}
            to="/courses/$courseId/units/$unitId/learn"
          >
            {unit.unlearned} lernen
          </Link>
        )}
        units={units}
      />
    </LearningLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/learn')({
  loader: async ({ params }) => {
    const [course, units] = await Promise.all([
      getCourse({ data: params.courseId }),
      listLearnableUnits({ data: params.courseId }),
    ]);
    return { course, units };
  },
  component: LearnUnitsScreen,
});
