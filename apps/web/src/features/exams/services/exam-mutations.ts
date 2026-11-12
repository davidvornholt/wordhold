import type { Database } from '@wordhold/db/client';
import type { CourseKind } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { Effect } from 'effect';
import { ExamDatabaseError } from '../errors/exam-errors';
import type { CreateExamData, UpdateExamData } from '../schemas/exam-models';
import { uuidArray } from './exam-reads';

// Why words or directions were refused: a word outside the course, which
// includes one deleted meanwhile, or a direction the course has no cards in.
type InputProblem = 'foreign-entries' | 'invalid-directions';

export type CreateExamResult =
  | { readonly kind: 'created'; readonly examId: string }
  | { readonly kind: 'course-missing' }
  | { readonly kind: InputProblem };

export type UpdateExamResult =
  | { readonly kind: 'updated' }
  | { readonly kind: 'exam-missing' }
  | { readonly kind: InputProblem };

export type StartRoundResult =
  | { readonly kind: 'started'; readonly roundId: string }
  | { readonly kind: 'exam-missing' }
  | { readonly kind: 'archived' }
  | { readonly kind: 'nothing-learned' };

const databaseError =
  (operation: string, message: string) => (cause: unknown) =>
    new ExamDatabaseError({ operation, cause, message });

const saveFailed = 'Der Test konnte nicht gespeichert werden.';

// A subject or collection asks its entries one way only. Each direction of a
// language course has cards: a word's synonyms and antonyms have theirs once
// it has such a list.
const fitsCourse = (
  kind: CourseKind,
  directions: ReadonlyArray<AnswerDirection>,
) =>
  kind === 'language' ||
  directions.every((direction) => direction === 'to_native');

// The values are enum names the request schema already validated, written as
// one literal so the driver does not decide how the array is shaped.
const directionsLiteral = (directions: ReadonlyArray<AnswerDirection>) =>
  `{${directions.join(',')}}`;

// Every entry has to be one of the course's; otherwise nothing changes.
const entriesFit = (
  sql: Database,
  courseId: string,
  entryIds: ReadonlyArray<string>,
) =>
  sql<{ readonly count: number }>`
    select count(*)::int as count from entries
    where id = any(${uuidArray(entryIds)}::uuid[]) and course_id = ${courseId}
  `.pipe(Effect.map((rows) => rows[0]?.count === entryIds.length));

const insertEntries = (
  sql: Database,
  examId: string,
  entryIds: ReadonlyArray<string>,
) =>
  sql`
    insert into exam_entries (exam_id, entry_id)
    select ${examId}, unnest(${uuidArray(entryIds)}::uuid[])
  `;

// The course row is shared-locked so it cannot be deleted halfway.
export const createExam = (sql: Database, input: CreateExamData) =>
  sql
    .withTransaction(
      Effect.gen(function* () {
        const [course] = yield* sql<{ readonly kind: CourseKind }>`
          select kind from courses where id = ${input.courseId} for share
        `;
        if (course === undefined) {
          return { kind: 'course-missing' } as const;
        }
        if (!fitsCourse(course.kind, input.directions)) {
          return { kind: 'invalid-directions' } as const;
        }
        if (!(yield* entriesFit(sql, input.courseId, input.entryIds))) {
          return { kind: 'foreign-entries' } as const;
        }
        const [exam] = yield* sql<{ readonly id: string }>`
          insert into exams (course_id, name, directions)
          values (
            ${input.courseId}, ${input.name},
            ${directionsLiteral(input.directions)}::answer_direction[]
          )
          returning id
        `;
        if (exam === undefined) {
          return yield* Effect.die(new Error('The test was not inserted.'));
        }
        yield* insertEntries(sql, exam.id, input.entryIds);
        return { kind: 'created', examId: exam.id } as const;
      }),
    )
    .pipe(Effect.mapError(databaseError('create exam', saveFailed)));

// Locks the test like a new round does, so a round never starts from half
// an edit.
export const updateExam = (sql: Database, input: UpdateExamData) =>
  sql
    .withTransaction(
      Effect.gen(function* () {
        const [exam] = yield* sql<{
          readonly courseId: string;
          readonly kind: CourseKind;
        }>`
          select x.course_id as "courseId", co.kind
          from exams x join courses co on co.id = x.course_id
          where x.id = ${input.examId}
          for update of x
        `;
        if (exam === undefined) {
          return { kind: 'exam-missing' } as const;
        }
        if (!fitsCourse(exam.kind, input.directions)) {
          return { kind: 'invalid-directions' } as const;
        }
        if (!(yield* entriesFit(sql, exam.courseId, input.entryIds))) {
          return { kind: 'foreign-entries' } as const;
        }
        yield* sql`
          update exams
          set name = ${input.name},
            directions = ${directionsLiteral(input.directions)}::answer_direction[]
          where id = ${input.examId}
        `;
        yield* sql`delete from exam_entries where exam_id = ${input.examId}`;
        yield* insertEntries(sql, input.examId, input.entryIds);
        return { kind: 'updated' } as const;
      }),
    )
    .pipe(Effect.mapError(databaseError('update exam', saveFailed)));

// Archiving again keeps the first archiving time.
export const setExamArchived = (
  sql: Database,
  examId: string,
  archived: boolean,
) =>
  sql<{ readonly id: string }>`
    update exams
    set archived_at = case when ${archived} then coalesce(archived_at, now()) end
    where id = ${examId}
    returning id
  `.pipe(
    Effect.map((rows) => rows.length > 0),
    Effect.mapError(databaseError('archive exam', saveFailed)),
  );

// The answers given in its rounds stay in the review log as ordinary
// practice.
export const deleteExam = (sql: Database, examId: string) =>
  sql<{ readonly id: string }>`
    delete from exams where id = ${examId} returning id
  `.pipe(
    Effect.map((rows) => rows.length > 0),
    Effect.mapError(
      databaseError('delete exam', 'Der Test konnte nicht gelöscht werden.'),
    ),
  );

// The test's cards in its directions that have been learned.
const learnedCards = (sql: Database, examId: string) => sql`
  select c.id
  from exams x
  join exam_entries xe on xe.exam_id = x.id
  join cards c on c.entry_id = xe.entry_id and c.direction = any(x.directions)
  where x.id = ${examId} and c.introduced_at is not null
`;

// A round asks every learned card of the test. The lock keeps an edit of the
// test from landing between choosing the cards and writing them down.
export const startExamRound = (sql: Database, examId: string) =>
  sql
    .withTransaction(
      Effect.gen(function* () {
        const [exam] = yield* sql<{
          readonly archived: boolean;
          readonly learned: boolean;
        }>`
          select archived_at is not null as archived,
            exists(${learnedCards(sql, examId)}) as learned
          from exams where id = ${examId}
          for update
        `;
        if (exam === undefined) {
          return { kind: 'exam-missing' } as const;
        }
        if (exam.archived) {
          return { kind: 'archived' } as const;
        }
        if (!exam.learned) {
          return { kind: 'nothing-learned' } as const;
        }
        const [round] = yield* sql<{ readonly id: string }>`
          insert into exam_rounds (exam_id) values (${examId}) returning id
        `;
        if (round === undefined) {
          return yield* Effect.die(new Error('The round was not inserted.'));
        }
        yield* sql`
          insert into exam_round_cards (round_id, card_id)
          select ${round.id}, learned.id
          from (${learnedCards(sql, examId)}) learned
        `;
        return { kind: 'started', roundId: round.id } as const;
      }),
    )
    .pipe(
      Effect.mapError(
        databaseError(
          'start exam round',
          'Die Testrunde konnte nicht gestartet werden.',
        ),
      ),
    );
