import { Database } from '@wordhold/db/client';
import type { CourseKind } from '@wordhold/db/schema/courses';
import { Context, Effect, Layer } from 'effect';
import { normalizeAnswer } from '../../../shared/grading/normalize';
import { wordLocation } from '../../../shared/vocabulary/book-name';
import { findDuplicate } from '../../../shared/vocabulary/entry-identity';
import { saveDerivedKeyPoints } from '../../../shared/vocabulary/key-points';
import { CourseDatabaseError } from '../errors/courses-errors';
import type { CreateTermEntryData } from '../schemas/term-entry-creation';
import type { WordPlace } from './vocabulary-entry-store';

export type TermPlace = {
  readonly kind: CourseKind;
  readonly courseName: string;
  readonly unitName: string | null;
};

export type StoredTerm = {
  readonly term: string;
  readonly definition: string;
  readonly keyPoints: ReadonlyArray<string> | null;
};

export type CreateTermEntryResult =
  | { readonly kind: 'created'; readonly entryId: string }
  | { readonly kind: 'place-missing' }
  | { readonly kind: 'not-terms' }
  | { readonly kind: 'duplicate'; readonly location: string };

type CourseTermRow = {
  readonly targetText: string;
  readonly bookName: string;
  readonly unitName: string | null;
};

const databaseError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Der Begriff konnte nicht gespeichert werden.',
  });

export class TermEntryStore extends Context.Tag('wordhold/TermEntryStore')<
  TermEntryStore,
  {
    // Undefined when the book does not belong to the course or the unit
    // not to the book.
    readonly readPlace: (
      courseId: string,
      place: WordPlace,
    ) => Effect.Effect<TermPlace | undefined, CourseDatabaseError>;
    readonly create: (
      input: CreateTermEntryData,
    ) => Effect.Effect<CreateTermEntryResult, CourseDatabaseError>;
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

      // A book without the unit yields no row when a unit was asked for,
      // because the unit's name is then required to match.
      const selectPlace = (courseId: string, { bookId, unitId }: WordPlace) =>
        sql<TermPlace>`
          select co.kind, co.name as "courseName", u.name as "unitName"
          from books b
          join courses co on co.id = b.course_id
          left join units u on u.id = ${unitId}::uuid and u.book_id = b.id
          where b.id = ${bookId} and b.course_id = ${courseId}
            and (${unitId}::uuid is null or u.id is not null)
          limit 1
        `.pipe(Effect.map((rows) => rows[0]));

      const readPlace = (courseId: string, place: WordPlace) =>
        selectPlace(courseId, place).pipe(
          Effect.mapError((cause) => databaseError('read term place', cause)),
        );

      const insertTerm = (input: CreateTermEntryData) =>
        Effect.gen(function* () {
          const [entry] = yield* sql<{ readonly id: string }>`
            insert into entries
              (course_id, book_id, unit_id, target_text, native_text)
            values (${input.courseId}, ${input.bookId}, ${input.unitId},
              ${input.term}, ${input.definition})
            returning id
          `;
          if (entry === undefined) {
            return yield* databaseError(
              'create term',
              new Error('The term was not inserted.'),
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

      // The same per-course lock the language entries take. A term is asked
      // only from term to definition, so it gets that one card and the
      // definition as its one accepted answer. An exact repeat of a term
      // anywhere in the subject is refused.
      const create = (input: CreateTermEntryData) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`select pg_advisory_xact_lock(hashtextextended(${input.courseId}, 0))`;
              const place = yield* selectPlace(input.courseId, input);
              if (place === undefined) {
                return { kind: 'place-missing' } as const;
              }
              if (place.kind !== 'terms') {
                return { kind: 'not-terms' } as const;
              }
              const rows = yield* sql<CourseTermRow>`
                select e.target_text as "targetText",
                  b.name as "bookName", u.name as "unitName"
                from entries e
                join books b on b.id = e.book_id
                left join units u on u.id = e.unit_id
                where e.course_id = ${input.courseId}
              `;
              const duplicate = findDuplicate(
                { targetText: input.term, example: '' },
                rows.map((row) => ({
                  targetText: row.targetText,
                  examples: [],
                  location: wordLocation(row.bookName, row.unitName),
                })),
              );
              if (duplicate.verdict === 'exact') {
                return {
                  kind: 'duplicate',
                  location: duplicate.entry.location,
                } as const;
              }
              const entryId = yield* insertTerm(input);
              return { kind: 'created', entryId } as const;
            }),
          )
          .pipe(
            Effect.catchTag('SqlError', (cause) =>
              Effect.fail(databaseError('create term', cause)),
            ),
          );

      const readTerm = (courseId: string, entryId: string) =>
        sql<StoredTerm>`
          select e.target_text as term, e.native_text as definition,
            e.key_points as "keyPoints"
          from entries e
          join courses co on co.id = e.course_id
          where e.id = ${entryId} and e.course_id = ${courseId}
            and co.kind = 'terms'
          limit 1
        `.pipe(
          Effect.map((rows) => rows[0]),
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
        readPlace,
        create,
        readTerm,
        saveDerivedKeyPoints: saveKeyPoints,
        setKeyPoints,
      } as const;
    }),
  );
}
