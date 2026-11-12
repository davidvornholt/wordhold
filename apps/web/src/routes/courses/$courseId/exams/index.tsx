import { createFileRoute, Link } from '@tanstack/react-router';
import { listItemNameClass } from '../../../../features/courses/ui/list-item-name-styles';
import { listExams } from '../../../../features/exams/services/server-fns';
import { ExamList } from '../../../../features/exams/ui/exam-list';
import { getCourse } from '../../../../features/import/server-fns';
import { ActionLink } from '../../../../shared/ui/action-link';
import { BackLink } from '../../../../shared/ui/back-link';
import { PageLayout } from '../../../../shared/ui/page-layout';

const ExamsScreen = () => {
  const { course, exams } = Route.useLoaderData();
  return (
    <PageLayout
      backControl={
        <BackLink params={{ courseId: course.id }} to="/courses/$courseId">
          {course.name}
        </BackLink>
      }
      title={`${course.name}: Tests`}
    >
      <ActionLink
        className="w-fit"
        params={{ courseId: course.id }}
        to="/courses/$courseId/exams/new"
        variant={exams.length === 0 ? 'primary' : 'outline'}
      >
        Test anlegen
      </ActionLink>
      <ExamList
        exams={exams}
        renderExamLink={(exam) => (
          <Link
            className={listItemNameClass}
            params={{ courseId: course.id, examId: exam.id }}
            to="/courses/$courseId/exams/$examId"
          >
            {exam.name}
          </Link>
        )}
        subject={course}
      />
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/exams/')({
  loader: async ({ params }) => {
    const [course, exams] = await Promise.all([
      getCourse({ data: params.courseId }),
      listExams({ data: { courseId: params.courseId } }),
    ]);
    return { course, exams };
  },
  component: ExamsScreen,
});
