import { type EditExamPayload, WordholdApi } from '@wordhold/api/api';
import { CurrentMember } from '@wordhold/api/current-member';
import { Rejected } from '@wordhold/api/errors';
import { Effect, Schema } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { runIn } from '../../../shared/api/api-failure';
import {
  assertOwned,
  type OwnedReferences,
} from '../../../shared/auth/ownership';
import { authRuntime } from '../../../shared/auth/runtime';
import {
  CreateExam,
  type ExamDetail,
  UpdateExam,
} from '../schemas/exam-models';
import { examRuntime } from '../services/exam-runtime';
import { ExamService } from '../services/exam-service';
import { editedEntryIds } from './exam-selection';
import { toApiExam, toApiExamSummary } from './exam-wire';

type Member = CurrentMember['Service'];
type Service = ExamService['Service'];

const owned = (member: Member, references: OwnedReferences) =>
  runIn(authRuntime, assertOwned(member.userId, references));

const withExams = <A, E>(work: (service: Service) => Effect.Effect<A, E>) =>
  runIn(examRuntime, Effect.flatMap(ExamService, work));

const noWords = new Rejected({
  message: 'A test needs at least one word. Give entries or units.',
});

const emptied = new Rejected({
  message:
    'A test keeps at least one word. Archive it instead, or delete it in the app.',
});

const changesWords = (payload: EditExamPayload) =>
  [
    payload.addEntryIds,
    payload.removeEntryIds,
    payload.addUnitIds,
    payload.removeUnitIds,
  ].some((ids) => ids !== undefined && ids.length > 0);

const changesContent = (payload: EditExamPayload) =>
  payload.name !== undefined ||
  payload.directions !== undefined ||
  changesWords(payload);

const saveContent = (
  service: Service,
  exam: ExamDetail,
  payload: EditExamPayload,
) =>
  Effect.gen(function* () {
    const added = yield* service.unitEntryIds(
      exam.courseId,
      payload.addUnitIds ?? [],
    );
    const removed = yield* service.unitEntryIds(
      exam.courseId,
      payload.removeUnitIds ?? [],
    );
    const entryIds = editedEntryIds(
      exam.entries.map((entry) => entry.id),
      [...(payload.addEntryIds ?? []), ...added],
      [...(payload.removeEntryIds ?? []), ...removed],
    );
    if (entryIds.length === 0) {
      return yield* emptied;
    }
    const input = yield* Schema.decodeUnknownEffect(UpdateExam)({
      examId: exam.id,
      name: payload.name ?? exam.name,
      directions: payload.directions ?? exam.directions,
      entryIds,
    });
    yield* service.update(input);
  });

const edit = (examId: string, payload: EditExamPayload) =>
  withExams((service) =>
    Effect.gen(function* () {
      const exam = yield* service.get(examId);
      if (changesContent(payload)) {
        yield* saveContent(service, exam, payload);
      }
      if (
        payload.archived !== undefined &&
        payload.archived !== (exam.archivedAt !== null)
      ) {
        yield* service.setArchived({ examId, archived: payload.archived });
      }
      return yield* service.get(examId);
    }),
  );

export const examsApi = HttpApiBuilder.group(WordholdApi, 'exams', (handlers) =>
  Effect.succeed(
    handlers
      .handle('list', ({ params }) =>
        Effect.gen(function* () {
          yield* owned(yield* CurrentMember, { courses: [params.id] });
          const exams = yield* withExams((service) => service.list(params.id));
          return exams.map(toApiExamSummary);
        }),
      )
      .handle('create', ({ params, payload }) =>
        Effect.gen(function* () {
          yield* owned(yield* CurrentMember, { courses: [params.id] });
          const exam = yield* withExams((service) =>
            Effect.gen(function* () {
              const unitEntryIds = yield* service.unitEntryIds(
                params.id,
                payload.unitIds ?? [],
              );
              const entryIds = [
                ...new Set([...(payload.entryIds ?? []), ...unitEntryIds]),
              ];
              if (entryIds.length === 0) {
                return yield* noWords;
              }
              const input = yield* Schema.decodeUnknownEffect(CreateExam)({
                courseId: params.id,
                name: payload.name,
                directions: payload.directions,
                entryIds,
              });
              const { examId } = yield* service.create(input);
              return yield* service.get(examId);
            }),
          );
          return toApiExam(exam);
        }),
      )
      .handle('get', ({ params }) =>
        Effect.gen(function* () {
          yield* owned(yield* CurrentMember, { exams: [params.id] });
          return toApiExam(
            yield* withExams((service) => service.get(params.id)),
          );
        }),
      )
      .handle('edit', ({ params, payload }) =>
        Effect.gen(function* () {
          yield* owned(yield* CurrentMember, { exams: [params.id] });
          return toApiExam(yield* edit(params.id, payload));
        }),
      ),
  ),
);
