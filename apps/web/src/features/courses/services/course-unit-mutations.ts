import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { CourseDatabaseError } from '../errors/courses-errors';

const databaseError = (operation: string, cause: unknown) =>
  new CourseDatabaseError({
    operation,
    cause,
    message: 'Die Einheit konnte nicht gespeichert werden.',
  });

export const makeCourseUnitMutations = (sql: Database) => {
  const createUnit = (courseId: string, name: string) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          yield* sql`select pg_advisory_xact_lock(hashtextextended(${courseId}, 0))`;
          const course = yield* sql<{ readonly id: string }>`
            select id from courses where id = ${courseId} limit 1
          `;
          if (course.length === 0) {
            return 'course-missing' as const;
          }
          const inserted = yield* sql<{ readonly id: string }>`
            insert into units (course_id, name, position)
            values (
              ${courseId},
              ${name},
              coalesce(
                (select max(position) + 1 from units where course_id = ${courseId}),
                0
              )
            )
            on conflict (course_id, name) do nothing
            returning id
          `;
          return inserted.length === 0
            ? ('duplicate' as const)
            : ('created' as const);
        }),
      )
      .pipe(Effect.mapError((cause) => databaseError('create unit', cause)));

  const reorderUnits = (courseId: string, unitIds: ReadonlyArray<string>) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          yield* sql`select pg_advisory_xact_lock(hashtextextended(${courseId}, 0))`;
          const current = yield* sql<{ readonly id: string }>`
            select id from units
            where course_id = ${courseId}
            order by position, name, id
          `;
          const currentIds = new Set(current.map((unit) => unit.id));
          if (
            currentIds.size !== unitIds.length ||
            unitIds.some((unitId) => !currentIds.has(unitId))
          ) {
            return false;
          }
          yield* sql`
            update units
            set position = -(position + 1)
            where course_id = ${courseId}
          `;
          yield* Effect.forEach(
            unitIds,
            (unitId, position) => sql`
              update units
              set position = ${position}
              where id = ${unitId} and course_id = ${courseId}
            `,
            { concurrency: 1 },
          );
          return true;
        }),
      )
      .pipe(Effect.mapError((cause) => databaseError('reorder units', cause)));

  return { createUnit, reorderUnits } as const;
};
