import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import { ImportDatabaseError } from '../errors/import-database-error';
import { listOrSeedCourses } from './course-seeding';

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

const listCourses = (sql: Database) =>
  sql<{
    id: string;
    name: string;
    targetLanguage: 'de' | 'en' | 'es' | 'fr';
    nativeLanguage: 'de' | 'en' | 'es' | 'fr';
    createdAt: Date;
  }>`select id, name, target_language as "targetLanguage", native_language as "nativeLanguage", created_at as "createdAt" from courses order by name`;

export const courseRepositoryLive = (sql: Database) => ({
  listOrSeedCourses: sql
    .withTransaction(
      Effect.gen(function* () {
        yield* sql`select pg_advisory_xact_lock(hashtextextended('wordhold:seed-courses', 0))`;
        return yield* listOrSeedCourses({
          list: listCourses(sql),
          insertSeeds:
            sql`insert into courses ${sql.insert(seeds.map((course) => ({ ...course })))}`.pipe(
              Effect.zipRight(listCourses(sql)),
            ),
        });
      }),
    )
    .pipe(Effect.mapError((cause) => failure('list or seed courses', cause))),
  getCourse: (courseId: string) =>
    sql<{
      id: string;
      name: string;
      targetLanguage: 'de' | 'en' | 'es' | 'fr';
      nativeLanguage: 'de' | 'en' | 'es' | 'fr';
      createdAt: Date;
    }>`select id, name, target_language as "targetLanguage", native_language as "nativeLanguage", created_at as "createdAt" from courses where id = ${courseId} limit 1`.pipe(
      Effect.map((rows) => rows[0]),
      Effect.mapError((cause) => failure('get course', cause)),
    ),
});
