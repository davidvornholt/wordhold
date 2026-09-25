import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { ImportDatabaseError } from '../errors/import-database-error';
import type { Book, Unit } from './repository';
import { selectUnitEntries } from './unit-entries';

const listFailure = (operation: string) => (cause: unknown) =>
  new ImportDatabaseError({
    operation,
    cause,
    message: `Database operation failed: ${operation}.`,
  });

export const unitRepositoryLive = (sql: Database) => ({
  listBooks: (courseId: string) =>
    sql<Book>`
      select books.id,
        books.name,
        max(entries.created_at) as "lastImportedAt"
      from books
      left join units on units.book_id = books.id
      left join entries on entries.unit_id = units.id
      where books.course_id = ${courseId}
      group by books.id
      order by books.position, books.id
    `.pipe(Effect.mapError(listFailure('list books'))),
  // The verify screen offers these for selection, so the entry count matters:
  // it is how you recognise the unit you started yesterday.
  listUnits: (courseId: string) =>
    sql<Unit>`
      select units.id,
        units.book_id as "bookId",
        units.name,
        units.position,
        units.is_holding as "isHolding",
        count(entries.id)::integer as "entryCount"
      from units
      join books on books.id = units.book_id
      left join entries
        on entries.unit_id = units.id
        and entries.course_id = units.course_id
      where units.course_id = ${courseId}
      group by units.id, books.id
      order by books.position, units.position, units.name
    `.pipe(Effect.mapError(listFailure('list units'))),
  // The verify screen compares extracted entries against these to flag a
  // page that was scanned before.
  listUnitEntries: (courseId: string) =>
    selectUnitEntries(sql, courseId).pipe(
      Effect.mapError(listFailure('list unit entries')),
    ),
});
