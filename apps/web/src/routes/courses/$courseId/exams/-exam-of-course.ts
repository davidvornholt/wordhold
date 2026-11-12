import { notFound } from '@tanstack/react-router';
import { getExam } from '../../../../features/exams/services/server-fns';

// A test belongs to one course; under another course's address it is not
// found rather than shown with the wrong course around it.
export const getExamOfCourse = async (courseId: string, examId: string) => {
  const exam = await getExam({ data: { examId } });
  if (exam.courseId !== courseId) {
    throw notFound();
  }
  return exam;
};
