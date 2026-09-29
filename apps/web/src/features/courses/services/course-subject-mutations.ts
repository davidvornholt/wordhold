import type { Database } from '@wordhold/db/client';
import type { CourseKind } from '@wordhold/db/schema/courses';
import { Effect } from 'effect';
import { CourseDatabaseError } from '../errors/courses-errors';

const databaseError = (
  operation: string,
  cause: unknown,
  message = 'Das Fach konnte nicht gespeichert werden.',
) => new CourseDatabaseError({ operation, cause, message });

// A new subject starts with one book, so its first term can be typed right
// away. The learner renames it or adds more books later.
export const firstSubjectBookName = 'Allgemein';

export type CreateSubjectResult =
  | { readonly kind: 'created'; readonly courseId: string }
  | { readonly kind: 'duplicate' };

// Both mutations take one lock for all course names, and a name is taken
// regardless of case, so two subjects never read the same on the overview.
export const makeCourseSubjectMutations = (sql: Database) => {
  const lockNames = sql`select pg_advisory_xact_lock(hashtextextended('wordhold:course-names', 0))`;

  const nameTaken = (name: string, exceptCourseId: string | null) =>
    sql<{ readonly id: string }>`
      select id from courses
      where lower(name) = lower(${name})
        and (${exceptCourseId}::uuid is null or id <> ${exceptCourseId}::uuid)
      limit 1
    `.pipe(Effect.map((rows) => rows.length > 0));

  const createSubject = (name: string) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          yield* lockNames;
          if (yield* nameTaken(name, null)) {
            return { kind: 'duplicate' } as const;
          }
          const [course] = yield* sql<{ readonly id: string }>`
            insert into courses
              (name, kind, target_language, native_language, directions)
            values (${name}, 'terms', 'de', 'de', '{to_native}')
            returning id
          `;
          if (course === undefined) {
            return yield* databaseError(
              'create subject',
              new Error('The subject was not inserted.'),
            );
          }
          yield* sql`
            insert into books (course_id, name, position)
            values (${course.id}, ${firstSubjectBookName}, 0)
          `;
          return { kind: 'created', courseId: course.id } as const;
        }),
      )
      .pipe(
        Effect.catchTag('SqlError', (cause) =>
          Effect.fail(databaseError('create subject', cause)),
        ),
      );

  // Only a subject is renamed here; a language course is named after its
  // language.
  const renameSubject = (courseId: string, name: string) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          yield* lockNames;
          if (yield* nameTaken(name, courseId)) {
            return 'duplicate' as const;
          }
          const renamed = yield* sql<{ readonly id: string }>`
            update courses set name = ${name}
            where id = ${courseId} and kind = 'terms'
            returning id
          `;
          return renamed.length === 0
            ? ('subject-missing' as const)
            : ('renamed' as const);
        }),
      )
      .pipe(Effect.mapError((cause) => databaseError('rename subject', cause)));

  const readKind = (courseId: string) =>
    sql<{ readonly kind: CourseKind }>`
      select kind from courses where id = ${courseId} limit 1
    `.pipe(
      Effect.map((rows) => rows[0]?.kind),
      Effect.mapError((cause) =>
        databaseError(
          'read course kind',
          cause,
          'Die Sprache oder das Fach konnte nicht geladen werden.',
        ),
      ),
    );

  return { createSubject, renameSubject, readKind } as const;
};
