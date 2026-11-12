import type { Database } from '@wordhold/db/client';
import {
  type AnswerDirection,
  answerDirections,
} from '@wordhold/db/schema/directions';
import { Effect, Schema } from 'effect';
import { ExamDatabaseError } from '../errors/exam-errors';
import type { ExamEntry } from '../schemas/exam-models';
import type { RoundCardRow, RoundCountRow } from './exam-results';

export type ExamRow = {
  readonly id: string;
  readonly courseId: string;
  readonly name: string;
  readonly directions: ReadonlyArray<AnswerDirection>;
  readonly createdAt: Date;
  readonly archivedAt: Date | null;
  readonly entryCount: number;
};

// A unit of the course with one of its words, or with none when it is empty.
export type UnitEntryRow = {
  readonly unitId: string;
  readonly entryId: string | null;
};

export type ExamCardCounts = {
  readonly learned: number;
  readonly unlearned: number;
  readonly unlearnedEntryIds: ReadonlyArray<string>;
};

export const uuidArray = (ids: ReadonlyArray<string>) => `{${ids.join(',')}}`;

// The driver hands an enum array back as raw text, so the query casts it to
// text[] and the values are checked here.
const decodeDirections = Schema.decodeUnknownEffect(
  Schema.Array(Schema.Literals(answerDirections)),
);

type StoredExamRow = Omit<ExamRow, 'directions'> & {
  readonly directions: unknown;
};

const readFailure = (cause: unknown) =>
  new ExamDatabaseError({
    operation: 'read exams',
    cause,
    message: 'Die Tests konnten nicht geladen werden.',
  });

// The exam store's queries that only read.
export const makeExamReads = (sql: Database) => {
  const decodeExam = (row: StoredExamRow) =>
    Effect.map(
      decodeDirections(row.directions),
      (directions): ExamRow => ({ ...row, directions }),
    );

  const examColumns = sql`
        x.id, x.course_id as "courseId", x.name,
        x.directions::text[] as directions,
        x.created_at as "createdAt", x.archived_at as "archivedAt",
        (select count(*)::int from exam_entries xe where xe.exam_id = x.id)
          as "entryCount"
      `;

  const list = (courseId: string) =>
    sql<StoredExamRow>`
          select ${examColumns} from exams x
          where x.course_id = ${courseId}
          order by x.archived_at is not null, x.created_at desc, x.id
        `.pipe(
      Effect.flatMap(Effect.forEach(decodeExam)),
      Effect.mapError(readFailure),
    );

  const read = (examId: string) =>
    sql<StoredExamRow>`
          select ${examColumns} from exams x where x.id = ${examId}
        `.pipe(
      Effect.flatMap((rows) =>
        rows[0] === undefined ? Effect.succeed(undefined) : decodeExam(rows[0]),
      ),
      Effect.mapError(readFailure),
    );

  const listEntries = (examId: string) =>
    sql<ExamEntry>`
          select e.id, e.target_text as "targetText",
            e.native_text as "nativeText"
          from exam_entries xe
          join entries e on e.id = xe.entry_id
          left join books b on b.id = e.book_id
          left join units u on u.id = e.unit_id
          where xe.exam_id = ${examId}
          order by b.position, u.position nulls first, e.created_at,
            e.target_text, e.id
        `.pipe(Effect.mapError(readFailure));

  const listUnitEntries = (courseId: string, unitIds: ReadonlyArray<string>) =>
    unitIds.length === 0
      ? Effect.succeed([])
      : sql<UnitEntryRow>`
              select u.id as "unitId", e.id as "entryId"
              from units u
              left join entries e on e.unit_id = u.id
              where u.course_id = ${courseId}
                and u.id = any(${uuidArray(unitIds)}::uuid[])
            `.pipe(Effect.mapError(readFailure));

  const countCards = (examId: string) =>
    sql<ExamCardCounts>`
          select
            count(*) filter (where c.introduced_at is not null)::int as learned,
            count(*) filter (where c.introduced_at is null)::int as unlearned,
            coalesce(
              array_agg(distinct c.entry_id::text)
                filter (where c.introduced_at is null),
              '{}'
            )::text[] as "unlearnedEntryIds"
          from exams x
          join exam_entries xe on xe.exam_id = x.id
          join cards c on c.entry_id = xe.entry_id
            and c.direction = any(x.directions)
          where x.id = ${examId}
        `.pipe(
      Effect.map(
        (rows) =>
          rows[0] ?? { learned: 0, unlearned: 0, unlearnedEntryIds: [] },
      ),
      Effect.mapError(readFailure),
    );

  // A card's first answer in a round is its result there. Later answers
  // in the same round, such as a card asked again, do not change it.
  const firstRating = sql`
        left join lateral (
          select rv.rating from reviews rv
          where rv.exam_round_id = rc.round_id and rv.card_id = rc.card_id
          order by rv.reviewed_at, rv.id
          limit 1
        ) first_answer on true
      `;

  const listRounds = (examIds: ReadonlyArray<string>) =>
    examIds.length === 0
      ? Effect.succeed([])
      : sql<RoundCountRow>`
              select r.id, r.exam_id as "examId", r.started_at as "startedAt",
                count(rc.card_id)::int as total,
                count(first_answer.rating)::int as answered,
                count(*) filter (where first_answer.rating > 1)::int as correct
              from exam_rounds r
              left join exam_round_cards rc on rc.round_id = r.id
              ${firstRating}
              where r.exam_id = any(${uuidArray(examIds)}::uuid[])
              group by r.id
              order by r.started_at desc, r.id desc
            `.pipe(Effect.mapError(readFailure));

  const listRoundCards = (roundIds: ReadonlyArray<string>) =>
    roundIds.length === 0
      ? Effect.succeed([])
      : sql<RoundCardRow>`
              select rc.round_id as "roundId", c.id as "cardId",
                e.id as "entryId", c.direction,
                e.target_text as "targetText", e.native_text as "nativeText",
                first_answer.rating as "firstRating"
              from exam_round_cards rc
              join cards c on c.id = rc.card_id
              join entries e on e.id = c.entry_id
              ${firstRating}
              where rc.round_id = any(${uuidArray(roundIds)}::uuid[])
              order by e.created_at, e.id, c.direction
            `.pipe(Effect.mapError(readFailure));

  return {
    list,
    read,
    listEntries,
    listUnitEntries,
    countCards,
    listRounds,
    listRoundCards,
  } as const;
};
