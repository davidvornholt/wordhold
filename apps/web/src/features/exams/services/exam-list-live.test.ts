import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { fixtureCourseId } from '../../../shared/testing/introduced-card-fixture';
import { ExamService } from './exam-service';
import {
  createLearnedExam,
  runExamTest,
} from './exam-service-live-test-support';

const createdOn = (name: string, createdAt: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const { examId } = yield* createLearnedExam(name);
    yield* sql`
      update exams set created_at = ${new Date(createdAt)}
      where id = ${examId}
    `;
    return examId;
  });

const roundOn = (examId: string, startedAt: string) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const service = yield* ExamService;
    const { roundId } = yield* service.startRound(examId);
    yield* sql`
      update exam_rounds set started_at = ${new Date(startedAt)}
      where id = ${roundId}
    `;
  });

describe('ExamService list', () => {
  it('lists the most recently practised test first, by its newest round or else its creation', async () => {
    await runExamTest(
      Effect.gen(function* () {
        const service = yield* ExamService;
        const longAgo = yield* createdOn('Unit 1', '2026-09-01T10:00:00Z');
        const recent = yield* createdOn('Unit 2', '2026-09-02T10:00:00Z');
        const unpractised = yield* createdOn('Unit 3', '2026-11-01T10:00:00Z');
        yield* roundOn(longAgo, '2026-09-20T10:00:00Z');
        // The round started last is not always the newest one.
        yield* roundOn(recent, '2026-11-18T10:00:00Z');
        yield* roundOn(recent, '2026-09-10T10:00:00Z');

        const exams = yield* service.list(fixtureCourseId);
        expect(exams.map((exam) => exam.id)).toEqual([
          recent,
          unpractised,
          longAgo,
        ]);
      }),
    );
  });
});
