import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { CourseDatabaseError } from '../errors/courses-errors';

const databaseError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Das Buch konnte nicht gespeichert werden.',
  });

export type CreateBookResult =
  | { readonly kind: 'created'; readonly bookId: string }
  | { readonly kind: 'duplicate' }
  | { readonly kind: 'course-missing' };

// Both mutations take the per-course lock the unit mutations and the import
// take, so a book cannot be renamed while a page is being filed into it under
// its old name.
export const makeCourseBookMutations = (sql: Database) => {
  const createBook = (courseId: string, name: string) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          yield* sql`select pg_advisory_xact_lock(hashtextextended(${courseId}, 0))`;
          const course = yield* sql<{ readonly id: string }>`
            select id from courses where id = ${courseId} limit 1
          `;
          if (course.length === 0) {
            return { kind: 'course-missing' } as const;
          }
          const inserted = yield* sql<{ readonly id: string }>`
            insert into books (course_id, name, position)
            values (
              ${courseId},
              ${name},
              coalesce(
                (select max(position) + 1 from books where course_id = ${courseId}),
                0
              )
            )
            on conflict (course_id, name) do nothing
            returning id
          `;
          const [book] = inserted;
          return book === undefined
            ? ({ kind: 'duplicate' } as const)
            : ({ kind: 'created', bookId: book.id } as const);
        }),
      )
      .pipe(Effect.mapError((cause) => databaseError('create book', cause)));

  const renameBook = (courseId: string, bookId: string, name: string) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          yield* sql`select pg_advisory_xact_lock(hashtextextended(${courseId}, 0))`;
          const taken = yield* sql<{ readonly id: string }>`
            select id from books
            where course_id = ${courseId} and name = ${name} and id <> ${bookId}
            limit 1
          `;
          if (taken.length > 0) {
            return 'duplicate' as const;
          }
          const renamed = yield* sql<{ readonly id: string }>`
            update books set name = ${name}
            where id = ${bookId} and course_id = ${courseId}
            returning id
          `;
          return renamed.length === 0
            ? ('book-missing' as const)
            : ('renamed' as const);
        }),
      )
      .pipe(Effect.mapError((cause) => databaseError('rename book', cause)));

  return { createBook, renameBook } as const;
};
