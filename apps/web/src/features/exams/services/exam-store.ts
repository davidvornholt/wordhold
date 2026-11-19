import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer } from 'effect';
import type { ExamDatabaseError } from '../errors/exam-errors';
import type {
  CreateExamData,
  ExamEntry,
  UpdateExamData,
} from '../schemas/exam-models';
import {
  type CreateExamResult,
  createExam,
  deleteExam,
  type StartRoundResult,
  startExamRound,
  type UpdateExamResult,
  updateExam,
} from './exam-mutations';
import {
  type ExamCardCounts,
  type ExamRow,
  makeExamReads,
  type UnitEntryRow,
} from './exam-reads';
import type { RoundCardRow, RoundCountRow } from './exam-results';

export class ExamStore extends Context.Service<
  ExamStore,
  {
    // The most recently practised first: by the start of the newest round,
    // or by creation before the first round.
    readonly list: (
      courseId: string,
    ) => Effect.Effect<ReadonlyArray<ExamRow>, ExamDatabaseError>;
    readonly read: (
      examId: string,
    ) => Effect.Effect<ExamRow | undefined, ExamDatabaseError>;
    // In the course's order: by book, unit and when the entry was added.
    readonly listEntries: (
      examId: string,
    ) => Effect.Effect<ReadonlyArray<ExamEntry>, ExamDatabaseError>;
    readonly listUnitEntries: (
      courseId: string,
      unitIds: ReadonlyArray<string>,
    ) => Effect.Effect<ReadonlyArray<UnitEntryRow>, ExamDatabaseError>;
    readonly countCards: (
      examId: string,
    ) => Effect.Effect<ExamCardCounts, ExamDatabaseError>;
    // Newest first.
    readonly listRounds: (
      examIds: ReadonlyArray<string>,
    ) => Effect.Effect<ReadonlyArray<RoundCountRow>, ExamDatabaseError>;
    readonly listRoundCards: (
      roundIds: ReadonlyArray<string>,
    ) => Effect.Effect<ReadonlyArray<RoundCardRow>, ExamDatabaseError>;
    readonly create: (
      input: CreateExamData,
    ) => Effect.Effect<CreateExamResult, ExamDatabaseError>;
    readonly update: (
      input: UpdateExamData,
    ) => Effect.Effect<UpdateExamResult, ExamDatabaseError>;
    // Resolves false when there is no such test.
    readonly remove: (
      examId: string,
    ) => Effect.Effect<boolean, ExamDatabaseError>;
    readonly startRound: (
      examId: string,
    ) => Effect.Effect<StartRoundResult, ExamDatabaseError>;
  }
>()('wordhold/ExamStore') {
  static readonly live = Layer.effect(
    ExamStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      return ExamStore.of({
        ...makeExamReads(sql),
        create: (input) => createExam(sql, input),
        update: (input) => updateExam(sql, input),
        remove: (examId) => deleteExam(sql, examId),
        startRound: (examId) => startExamRound(sql, examId),
      });
    }),
  );
}
