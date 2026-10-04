import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { seedOwner } from '../../../shared/testing/owner-fixture';
import { courseRepositoryLive } from './course-repository-live';

const ownerId = 'owner';
const otherOwnerId = 'other-owner';
const defaultLanguages = ['Englisch', 'Französisch', 'Spanisch'];

const names = (courses: ReadonlyArray<{ readonly name: string }>) =>
  courses.map((course) => course.name);

describe('courseRepositoryLive', () => {
  it('starts each person with their own default languages', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* seedOwner(ownerId);
          yield* seedOwner(otherOwnerId);
          const sql = yield* Database;
          const repository = courseRepositoryLive(sql);

          const own = yield* repository.listOrSeedCourses(ownerId);
          expect(names(own)).toEqual(defaultLanguages);
          yield* sql`
            insert into courses
              (owner_id, name, kind, target_language, native_language, directions)
            values (${ownerId}, 'Chemie', 'terms', 'de', 'de', '{to_native}')
          `;

          const other = yield* repository.listOrSeedCourses(otherOwnerId);
          expect(names(other)).toEqual(defaultLanguages);
          const ownIds = new Set(own.map((course) => course.id));
          expect(other.filter((course) => ownIds.has(course.id))).toEqual([]);
          expect(names(yield* repository.listOrSeedCourses(ownerId))).toEqual([
            'Chemie',
            ...defaultLanguages,
          ]);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });
});
