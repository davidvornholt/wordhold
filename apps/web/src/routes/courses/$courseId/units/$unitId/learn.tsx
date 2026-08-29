import { createFileRoute, Link } from '@tanstack/react-router';
import { getCourse } from '../../../../../features/import/server-fns';
import {
  getLearnPass,
  introduceEntry,
} from '../../../../../features/learning/services/server-fns';
import { LearnPass } from '../../../../../features/learning/ui/learn-pass';
import { LearningLayout } from '../../../../../features/learning/ui/learning-layout';
import { germanLabels } from '../../../../../shared/languages';

const LearnUnitScreen = () => {
  const { course, pass } = Route.useLoaderData();

  return (
    <LearningLayout
      backControl={
        <Link
          className="text-muted-foreground text-sm underline"
          params={{ courseId: course.id, unitId: pass.unit.id }}
          to="/courses/$courseId/units/$unitId"
        >
          ← {pass.unit.name}
        </Link>
      }
      title={`${pass.unit.name} lernen`}
    >
      <LearnPass
        items={pass.items}
        onIntroduce={async (entryId) => {
          await introduceEntry({
            data: {
              courseId: course.id,
              unitId: pass.unit.id,
              entryId,
            },
          });
        }}
        practiceControl={
          <Link
            className="w-fit font-medium text-sm underline"
            params={{ courseId: course.id }}
            to="/courses/$courseId/practice"
          >
            Jetzt üben
          </Link>
        }
        targetLabel={germanLabels[course.targetLanguage]}
        targetLanguage={course.targetLanguage}
      />
    </LearningLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/units/$unitId/learn')({
  loader: async ({ params }) => {
    const [course, pass] = await Promise.all([
      getCourse({ data: params.courseId }),
      getLearnPass({
        data: { courseId: params.courseId, unitId: params.unitId },
      }),
    ]);
    return { course, pass };
  },
  component: LearnUnitScreen,
});
