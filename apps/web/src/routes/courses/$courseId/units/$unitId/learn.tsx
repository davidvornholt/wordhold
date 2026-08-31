import { createFileRoute } from '@tanstack/react-router';
import { getCourse } from '../../../../../features/import/server-fns';
import {
  getLearnPass,
  introduceCard,
} from '../../../../../features/learning/services/server-fns';
import { LearnPass } from '../../../../../features/learning/ui/learn-pass';
import { germanLabels } from '../../../../../shared/languages';
import { ActionLink } from '../../../../../shared/ui/action-link';
import { BackLink } from '../../../../../shared/ui/back-link';
import { PageLayout } from '../../../../../shared/ui/page-layout';

const LearnUnitScreen = () => {
  const { course, pass } = Route.useLoaderData();

  return (
    <PageLayout
      backControl={
        <BackLink
          params={{ courseId: course.id, unitId: pass.unit.id }}
          to="/courses/$courseId/units/$unitId"
        >
          {pass.unit.name}
        </BackLink>
      }
      title={`${pass.unit.name} kennenlernen`}
    >
      <LearnPass
        items={pass.items}
        onIntroduce={async (cardId) => {
          await introduceCard({
            data: {
              courseId: course.id,
              unitId: pass.unit.id,
              cardId,
            },
          });
        }}
        practiceControl={
          <ActionLink
            className="w-fit"
            params={{ courseId: course.id }}
            to="/courses/$courseId/practice"
          >
            Erste Abfrage starten
          </ActionLink>
        }
        targetLabel={germanLabels[course.targetLanguage]}
        targetLanguage={course.targetLanguage}
      />
    </PageLayout>
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
