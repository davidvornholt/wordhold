import { Context, Effect, Layer } from 'effect';
import {
  type ExamDatabaseError,
  ExamInputError,
  ExamNotFoundError,
  ExamStateError,
} from '../errors/exam-errors';
import type {
  CreateExamData,
  ExamDetail,
  ExamSummary,
  SetExamArchivedData,
  UpdateExamData,
} from '../schemas/exam-models';
import type {
  CreateExamResult,
  StartRoundResult,
  UpdateExamResult,
} from './exam-mutations';
import {
  comparedRounds,
  examReadiness,
  openRound,
  roundScore,
} from './exam-results';
import { ExamStore } from './exam-store';

const examMissing = new ExamNotFoundError({
  message: 'Diesen Test gibt es nicht mehr. Lade die Seite neu.',
});

const courseMissing = new ExamNotFoundError({
  message:
    'Diese Sprache, dieses Fach oder diese Sammlung gibt es nicht mehr. Lade die Seite neu.',
});

const foreignEntries = new ExamInputError({
  message:
    'Einige der gewählten Einträge gibt es hier nicht mehr. Lade die Seite neu und wähle noch einmal aus.',
});

const invalidDirections = new ExamInputError({
  message: 'Ein Fach oder eine Sammlung fragt nur in eine Richtung ab.',
});

const archived = new ExamStateError({
  message:
    'Dieser Test ist archiviert. Hole ihn zurück, um eine neue Runde zu starten.',
});

const nothingLearned = new ExamStateError({
  message:
    'Du hast noch keine Karte dieses Tests kennengelernt. Lerne seine Einträge zuerst kennen.',
});

type ExamFailure = ExamDatabaseError | ExamNotFoundError;

const created = (
  result: CreateExamResult,
): Effect.Effect<
  { readonly examId: string },
  ExamNotFoundError | ExamInputError
> => {
  switch (result.kind) {
    case 'course-missing':
      return Effect.fail(courseMissing);
    case 'foreign-entries':
      return Effect.fail(foreignEntries);
    case 'invalid-directions':
      return Effect.fail(invalidDirections);
    case 'created':
      return Effect.succeed({ examId: result.examId });
    default:
      return result satisfies never;
  }
};

const updated = (
  result: UpdateExamResult,
): Effect.Effect<void, ExamNotFoundError | ExamInputError> => {
  switch (result.kind) {
    case 'exam-missing':
      return Effect.fail(examMissing);
    case 'foreign-entries':
      return Effect.fail(foreignEntries);
    case 'invalid-directions':
      return Effect.fail(invalidDirections);
    case 'updated':
      return Effect.void;
    default:
      return result satisfies never;
  }
};

const started = (
  result: StartRoundResult,
): Effect.Effect<
  { readonly roundId: string },
  ExamNotFoundError | ExamStateError
> => {
  switch (result.kind) {
    case 'exam-missing':
      return Effect.fail(examMissing);
    case 'archived':
      return Effect.fail(archived);
    case 'nothing-learned':
      return Effect.fail(nothingLearned);
    case 'started':
      return Effect.succeed({ roundId: result.roundId });
    default:
      return result satisfies never;
  }
};

export class ExamService extends Context.Service<
  ExamService,
  {
    readonly list: (
      courseId: string,
    ) => Effect.Effect<ReadonlyArray<ExamSummary>, ExamDatabaseError>;
    readonly get: (examId: string) => Effect.Effect<ExamDetail, ExamFailure>;
    readonly create: (
      input: CreateExamData,
    ) => Effect.Effect<
      { readonly examId: string },
      ExamFailure | ExamInputError
    >;
    readonly update: (
      input: UpdateExamData,
    ) => Effect.Effect<void, ExamFailure | ExamInputError>;
    readonly setArchived: (
      input: SetExamArchivedData,
    ) => Effect.Effect<void, ExamFailure>;
    readonly remove: (examId: string) => Effect.Effect<void, ExamFailure>;
    readonly startRound: (
      examId: string,
    ) => Effect.Effect<
      { readonly roundId: string },
      ExamFailure | ExamStateError
    >;
  }
>()('wordhold/ExamService') {
  static readonly layer = Layer.effect(
    ExamService,
    Effect.gen(function* () {
      const store = yield* ExamStore;

      const list = Effect.fn('ExamService.list')(function* (courseId: string) {
        const exams = yield* store.list(courseId);
        const rounds = yield* store.listRounds(exams.map((exam) => exam.id));
        return exams.map(
          (exam): ExamSummary => ({
            ...exam,
            lastRound:
              comparedRounds(
                rounds
                  .filter((round) => round.examId === exam.id)
                  .map(roundScore),
              )[0] ?? null,
          }),
        );
      });

      const get = Effect.fn('ExamService.get')(function* (examId: string) {
        const exam = yield* store.read(examId);
        if (exam === undefined) {
          return yield* examMissing;
        }
        const entries = yield* store.listEntries(examId);
        const cards = yield* store.countCards(examId);
        const rounds = (yield* store.listRounds([examId])).map(roundScore);
        const roundCards = yield* store.listRoundCards(
          comparedRounds(rounds).map((round) => round.id),
        );
        return {
          ...exam,
          entries,
          cards,
          rounds,
          openRound: openRound(rounds),
          readiness: examReadiness(rounds, roundCards),
        } satisfies ExamDetail;
      });

      const create = Effect.fn('ExamService.create')(function* (
        input: CreateExamData,
      ) {
        return yield* created(yield* store.create(input));
      });

      const update = Effect.fn('ExamService.update')(function* (
        input: UpdateExamData,
      ) {
        return yield* updated(yield* store.update(input));
      });

      const setArchived = Effect.fn('ExamService.setArchived')(function* (
        input: SetExamArchivedData,
      ) {
        if (!(yield* store.setArchived(input.examId, input.archived))) {
          return yield* examMissing;
        }
      });

      const remove = Effect.fn('ExamService.remove')(function* (
        examId: string,
      ) {
        if (!(yield* store.remove(examId))) {
          return yield* examMissing;
        }
      });

      const startRound = Effect.fn('ExamService.startRound')(function* (
        examId: string,
      ) {
        return yield* started(yield* store.startRound(examId));
      });

      return ExamService.of({
        list,
        get,
        create,
        update,
        setArchived,
        remove,
        startRound,
      });
    }),
  );
}
