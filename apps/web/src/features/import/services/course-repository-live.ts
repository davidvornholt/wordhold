import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { ImportDatabaseError } from '../errors/import-database-error';
import { listOrSeedCourses } from './course-seeding';
import type { Course } from './repository';

const seeds = [
  { name: 'Englisch', targetLanguage: 'en' },
  { name: 'Französisch', targetLanguage: 'fr' },
  { name: 'Spanisch', targetLanguage: 'es' },
] as const;

const failure = (operation: string, cause: unknown) =>
  new ImportDatabaseError({
    operation,
    cause,
    message: `Database operation failed: ${operation}.`,
  });

const courseColumns = (sql: Database) =>
  sql`id, name, kind, target_language as "targetLanguage", native_language as "nativeLanguage", created_at as "createdAt"`;

const listCourses = (sql: Database, ownerId: string) =>
  sql<Course>`select ${courseColumns(sql)} from courses where owner_id = ${ownerId} order by name`;

export const courseRepositoryLive = (sql: Database) => ({
  listOrSeedCourses: (ownerId: string) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          yield* sql`select pg_advisory_xact_lock(hashtextextended(${`wordhold:seed-courses:${ownerId}`}, 0))`;
          return yield* listOrSeedCourses({
            list: listCourses(sql, ownerId),
            insertSeeds:
              sql`insert into courses ${sql.insert(seeds.map((course) => ({ ...course, ownerId })))}`.pipe(
                Effect.andThen(listCourses(sql, ownerId)),
              ),
          });
        }),
      )
      .pipe(Effect.mapError((cause) => failure('list or seed courses', cause))),
  getCourse: (courseId: string) =>
    sql<Course>`select ${courseColumns(sql)} from courses where id = ${courseId} limit 1`.pipe(
      Effect.map((rows) => rows[0]),
      Effect.mapError((cause) => failure('get course', cause)),
    ),
});
