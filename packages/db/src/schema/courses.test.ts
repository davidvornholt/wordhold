import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { Database } from '../client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '../testing/postgres-test-database';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('course direction constraint', () => {
  it('keeps at least one direction in PostgreSQL', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          const sql = yield* Database;
          yield* sql`
            insert into courses (id, name, target_language)
            values (${courseId}, 'French', 'fr')
          `;

          const update = yield* Effect.either(sql`
            update courses
            set directions = '{}'::answer_direction[]
            where id = ${courseId}
          `);
          expect(update._tag).toBe('Left');
          const rows = yield* sql<{ readonly directions: string }>`
            select directions::text as directions
            from courses where id = ${courseId}
          `;
          expect(rows).toEqual([{ directions: '{to_target,to_native}' }]);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });
});
