import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { translationDirections } from '@wordhold/db/schema/directions';
import {
  getCourseDirections,
  listCourseVocabulary,
} from '../../../../features/courses/services/server-fns';
import { createExam } from '../../../../features/exams/services/server-fns';
import { ExamForm } from '../../../../features/exams/ui/exam-form';
import { getCourse } from '../../../../features/import/server-fns';
import { isListCourse } from '../../../../shared/directions';
import { ActionLink } from '../../../../shared/ui/action-link';
import { BackLink } from '../../../../shared/ui/back-link';
import { PageLayout } from '../../../../shared/ui/page-layout';

const NewExamScreen = () => {
  const { course, directions, entries } = Route.useLoaderData();
  const navigate = useNavigate();
  return (
    <PageLayout
      backControl={
        <BackLink
          params={{ courseId: course.id }}
          to="/courses/$courseId/exams"
        >
          Tests
        </BackLink>
      }
      title="Test anlegen"
    >
      <ExamForm
        cancelControl={
          <ActionLink
            params={{ courseId: course.id }}
            to="/courses/$courseId/exams"
            variant="quiet-muted"
          >
            Abbrechen
          </ActionLink>
        }
        courseDirections={directions}
        entries={entries}
        // A test usually asks a word both ways, whichever way the course
        // practises it.
        initial={{
          name: '',
          directions: isListCourse(course.kind)
            ? ['to_native']
            : translationDirections,
          entryIds: [],
        }}
        save={async (draft) => {
          const { examId } = await createExam({
            data: { courseId: course.id, ...draft },
          });
          await navigate({
            params: { courseId: course.id, examId },
            to: '/courses/$courseId/exams/$examId',
          });
        }}
        subject={course}
        submitLabel="Test anlegen"
      />
    </PageLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/exams/new')({
  loader: async ({ params }) => {
    const [course, directions, entries] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseDirections({ data: params.courseId }),
      listCourseVocabulary({ data: params.courseId }),
    ]);
    return { course, directions, entries };
  },
  component: NewExamScreen,
});
