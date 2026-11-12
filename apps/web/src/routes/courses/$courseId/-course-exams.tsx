import { Link } from '@tanstack/react-router';
import { listItemNameClass } from '../../../features/courses/ui/list-item-name-styles';
import type { ExamSummary } from '../../../features/exams/schemas/exam-models';
import { ExamSection } from '../../../features/exams/ui/exam-list';
import type { CourseSubject } from '../../../shared/directions';
import { ActionLink } from '../../../shared/ui/action-link';

type ExamCourse = CourseSubject & { readonly id: string };

export const CourseExams = ({
  course,
  exams,
}: {
  readonly course: ExamCourse;
  readonly exams: ReadonlyArray<ExamSummary>;
}) => (
  <ExamSection
    exams={exams}
    newExamAction={
      <ActionLink
        params={{ courseId: course.id }}
        to="/courses/$courseId/exams/new"
        variant="quiet"
      >
        Neuer Test
      </ActionLink>
    }
    renderArchiveLink={(count) => (
      <ActionLink
        className="w-fit"
        params={{ courseId: course.id }}
        to="/courses/$courseId/exams/archive"
        variant="quiet-muted"
      >
        Archiv ({count})
      </ActionLink>
    )}
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
);
