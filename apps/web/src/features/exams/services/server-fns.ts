import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';
import { requestMember } from '../../../shared/auth/member-request';
import {
  decodeCourseExamsRequest,
  decodeCreateExam,
  decodeExamRequest,
  decodeSetExamArchived,
  decodeUpdateExam,
} from '../schemas/exam-models';
import { examRuntime } from './exam-runtime';
import { ExamService } from './exam-service';

export const listExams = createServerFn()
  .validator(decodeCourseExamsRequest)
  .handler(async ({ data }) => {
    await requestMember({ courses: [data.courseId] });
    return examRuntime.runPromise(
      Effect.flatMap(ExamService, (service) => service.list(data.courseId)),
    );
  });

export const getExam = createServerFn()
  .validator(decodeExamRequest)
  .handler(async ({ data }) => {
    await requestMember({ exams: [data.examId] });
    return examRuntime.runPromise(
      Effect.flatMap(ExamService, (service) => service.get(data.examId)),
    );
  });

export const createExam = createServerFn({ method: 'POST' })
  .validator(decodeCreateExam)
  .handler(async ({ data }) => {
    await requestMember({ courses: [data.courseId], entries: data.entryIds });
    return examRuntime.runPromise(
      Effect.flatMap(ExamService, (service) => service.create(data)),
    );
  });

export const updateExam = createServerFn({ method: 'POST' })
  .validator(decodeUpdateExam)
  .handler(async ({ data }) => {
    await requestMember({ exams: [data.examId], entries: data.entryIds });
    return examRuntime.runPromise(
      Effect.flatMap(ExamService, (service) => service.update(data)),
    );
  });

export const setExamArchived = createServerFn({ method: 'POST' })
  .validator(decodeSetExamArchived)
  .handler(async ({ data }) => {
    await requestMember({ exams: [data.examId] });
    return examRuntime.runPromise(
      Effect.flatMap(ExamService, (service) => service.setArchived(data)),
    );
  });

export const deleteExam = createServerFn({ method: 'POST' })
  .validator(decodeExamRequest)
  .handler(async ({ data }) => {
    await requestMember({ exams: [data.examId] });
    return examRuntime.runPromise(
      Effect.flatMap(ExamService, (service) => service.remove(data.examId)),
    );
  });

export const startExamRound = createServerFn({ method: 'POST' })
  .validator(decodeExamRequest)
  .handler(async ({ data }) => {
    await requestMember({ exams: [data.examId] });
    return examRuntime.runPromise(
      Effect.flatMap(ExamService, (service) => service.startRound(data.examId)),
    );
  });
