import { Database } from '@wordhold/db/client';
import type { CourseKind } from '@wordhold/db/schema/courses';
import { Context, Effect, Layer } from 'effect';
import { normalizeAnswer } from '../../../shared/grading/normalize';
import { findDuplicate } from '../../../shared/vocabulary/entry-identity';
import { saveDerivedKeyPoints } from '../../../shared/vocabulary/key-points';
import { CourseDatabaseError } from '../errors/courses-errors';
import type { UpdateTermEntryData } from '../schemas/entry-changes';
import type { CreateTermEntryData } from '../schemas/term-entry-creation';
import { replaceTextbookAnswers } from './entry-answers';

export type TermCourse = {
  readonly kind: CourseKind;
  readonly name: string;
};

export type StoredTerm = {
  readonly term: string;
  readonly definition: string;
  readonly keyPoints: ReadonlyArray<string> | null;
};

export type CreateTermEntryResult =
  | { readonly kind: 'created'; readonly entryId: string }
  | { readonly kind: 'course-missing' }
  | { readonly kind: 'not-terms' }
  | { readonly kind: 'duplicate' };

export type UpdateTermEntryResult =
  | { readonly kind: 'updated'; readonly definitionChanged: boolean }
  | { readonly kind: 'term-missing' }
  | { readonly kind: 'duplicate' };

const databaseError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Der Begriff konnte nicht gespeichert werden.',
  });

// Every entry needs a book, so a subject keeps its terms in the one
// book it is created with (see createSubject). The learner never sees
// that book.
const insertTerm = (sql: Database, input: CreateTermEntryData) =>
  Effect.gen(function* () {
    const [entry] = yield* sql<{ readonly id: string }>`
      insert into entries
        (course_id, book_id, unit_id, target_text, native_text)
      select ${input.courseId}, b.id, null, ${input.term},
        ${input.definition}
      from books b
      where b.course_id = ${input.courseId}
      order by b.position asc
      limit 1
      returning id
    `;
    if (entry === undefined) {
      return yield* databaseError(
        'create term',
        new Error('The subject has no book to hold its terms.'),
      );
    }
    yield* sql`
      insert into accepted_answers
        (entry_id, direction, text, normalized, source)
      values (${entry.id}, 'to_native', ${input.definition},
        ${normalizeAnswer(input.definition)}, 'textbook')
    `;
    yield* sql`
      insert into cards (entry_id, direction)
      values (${entry.id}, 'to_native')
    `;
    return entry.id;
  });

const selectTerm = (sql: Database, courseId: string, entryId: string) =>
  sql<StoredTerm>`
    select e.target_text as term, e.native_text as definition,
      e.key_points as "keyPoints"
    from entries e
    join courses co on co.id = e.course_id
    where e.id = ${entryId} and e.course_id = ${courseId}
      and co.kind = 'terms'
    limit 1
  `.pipe(Effect.map((rows) => rows[0]));

// An exact repeat of a term in the subject is refused. A corrected term
// is not compared with itself.
const repeatsTerm = (
  sql: Database,
  courseId: string,
  term: string,
  correctedEntryId: string | null,
) =>
  sql<{ readonly targetText: string }>`
    select target_text as "targetText" from entries
    where course_id = ${courseId}
      and (${correctedEntryId}::uuid is null or id <> ${correctedEntryId}::uuid)
  `.pipe(
    Effect.map(
      (rows) =>
        findDuplicate(
          { targetText: term, example: '' },
          rows.map((row) => ({
            targetText: row.targetText,
            examples: [],
          })),
        ).verdict === 'exact',
    ),
  );

// Runs in a transaction under the same lock as a new term. The card keeps
// its schedule. Key points describe the definition, so a new definition
// clears them to be derived again; a corrected term keeps them.
const correctTerm = (sql: Database, input: UpdateTermEntryData) =>
  Effect.gen(function* () {
    yield* sql`select pg_advisory_xact_lock(hashtextextended(${input.courseId}, 0))`;
    const stored = yield* selectTerm(sql, input.courseId, input.entryId);
    if (stored === undefined) {
      return { kind: 'term-missing' } as const;
    }
    if (yield* repeatsTerm(sql, input.courseId, input.term, input.entryId)) {
      return { kind: 'duplicate' } as const;
    }
    const definitionChanged = stored.definition !== input.definition;
    if (stored.term === input.term && !definitionChanged) {
      return { kind: 'updated', definitionChanged } as const;
    }
    yield* sql`
      update entries
      set target_text = ${input.term}, native_text = ${input.definition},
        key_points = case
          when native_text = ${input.definition} then key_points
        end
      where id = ${input.entryId}
    `;
    yield* replaceTextbookAnswers(sql, input.entryId, [
      { direction: 'to_native', text: input.definition },
    ]);
    return { kind: 'updated', definitionChanged } as const;
  });

export class TermEntryStore extends Context.Tag('wordhold/TermEntryStore')<
  TermEntryStore,
  {
    readonly readCourse: (
      courseId: string,
    ) => Effect.Effect<TermCourse | undefined, CourseDatabaseError>;
    readonly create: (
      input: CreateTermEntryData,
    ) => Effect.Effect<CreateTermEntryResult, CourseDatabaseError>;
    readonly update: (
      input: UpdateTermEntryData,
    ) => Effect.Effect<UpdateTermEntryResult, CourseDatabaseError>;
    // Undefined unless the entry is a term of that subject.
    readonly readTerm: (
      courseId: string,
      entryId: string,
    ) => Effect.Effect<StoredTerm | undefined, CourseDatabaseError>;
    // See saveDerivedKeyPoints.
    readonly saveDerivedKeyPoints: (
      entryId: string,
      definition: string,
      keyPoints: ReadonlyArray<string>,
    ) => Effect.Effect<ReadonlyArray<string> | null, CourseDatabaseError>;
    // Resolves false unless the entry is a term of that subject.
    readonly setKeyPoints: (
      courseId: string,
      entryId: string,
      keyPoints: ReadonlyArray<string>,
    ) => Effect.Effect<boolean, CourseDatabaseError>;
  }
>() {
  static readonly live = Layer.effect(
    TermEntryStore,
    Effect.gen(function* () {
      const sql = yield* Database;

      const selectCourse = (courseId: string) =>
        sql<TermCourse>`
          select kind, name from courses where id = ${courseId} limit 1
        `.pipe(Effect.map((rows) => rows[0]));

      const readCourse = (courseId: string) =>
        selectCourse(courseId).pipe(
          Effect.mapError((cause) => databaseError('read subject', cause)),
        );

      // The same per-course lock the language entries take. A term is asked
      // only from term to definition, so it gets that one card and the
      // definition as its one accepted answer.
      const create = (input: CreateTermEntryData) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`select pg_advisory_xact_lock(hashtextextended(${input.courseId}, 0))`;
              const course = yield* selectCourse(input.courseId);
              if (course === undefined) {
                return { kind: 'course-missing' } as const;
              }
              if (course.kind !== 'terms') {
                return { kind: 'not-terms' } as const;
              }
              if (yield* repeatsTerm(sql, input.courseId, input.term, null)) {
                return { kind: 'duplicate' } as const;
              }
              const entryId = yield* insertTerm(sql, input);
              return { kind: 'created', entryId } as const;
            }),
          )
          .pipe(
            Effect.catchTag('SqlError', (cause) =>
              Effect.fail(databaseError('create term', cause)),
            ),
          );

      const update = (input: UpdateTermEntryData) =>
        sql
          .withTransaction(correctTerm(sql, input))
          .pipe(
            Effect.catchTag('SqlError', (cause) =>
              Effect.fail(databaseError('update term', cause)),
            ),
          );

      const readTerm = (courseId: string, entryId: string) =>
        selectTerm(sql, courseId, entryId).pipe(
          Effect.mapError((cause) => databaseError('read term', cause)),
        );

      const saveKeyPoints = (
        entryId: string,
        definition: string,
        keyPoints: ReadonlyArray<string>,
      ) =>
        saveDerivedKeyPoints(sql, entryId, definition, keyPoints).pipe(
          Effect.mapError((cause) => databaseError('save key points', cause)),
        );

      const setKeyPoints = (
        courseId: string,
        entryId: string,
        keyPoints: ReadonlyArray<string>,
      ) =>
        sql`
          update entries e
          set key_points = array(
            select jsonb_array_elements_text(${JSON.stringify(keyPoints)}::jsonb)
          )
          from courses co
          where e.id = ${entryId} and e.course_id = ${courseId}
            and co.id = e.course_id and co.kind = 'terms'
          returning e.id
        `.pipe(
          Effect.map((rows) => rows.length > 0),
          Effect.mapError((cause) => databaseError('set key points', cause)),
        );

      return {
        readCourse,
        create,
        update,
        readTerm,
        saveDerivedKeyPoints: saveKeyPoints,
        setKeyPoints,
      } as const;
    }),
  );
}
