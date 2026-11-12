import { createFileRoute, Link } from '@tanstack/react-router';
import { listItemNameClass } from '../../../../features/courses/ui/list-item-name-styles';
import { listExams } from '../../../../features/exams/services/server-fns';
import { ArchivedExamList } from '../../../../features/exams/ui/exam-list';
import { getCourse } from '../../../../features/import/server-fns';
import { BackLink } from '../../../../shared/ui/back-link';
import { PageLayout } from '../../../../shared/ui/page-layout';

// The tests still ahead are on the course's page.
const ArchiveScreen = () => {
  const { course, exams } = Route.useLoaderData();
  return (
    <PageLayout
      backControl={
        <BackLink params={{ courseId: course.id }} to="/courses/$courseId">
          {course.name}
        </BackLink>
      }
      title={`${course.name}: archivierte Tests`}
    >
      <p className="text-muted-foreground text-sm">
        Ein archivierter Test behält seine Runden, startet aber keine neue. Auf
        der Seite eines Tests holst du ihn zurück.
      </p>
      <ArchivedExamList
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

export const Route = createFileRoute('/courses/$courseId/exams/archive')({
  loader: async ({ params }) => {
    const [course, exams] = await Promise.all([
      getCourse({ data: params.courseId }),
      listExams({ data: { courseId: params.courseId } }),
    ]);
    return { course, exams };
  },
  component: ArchiveScreen,
});
