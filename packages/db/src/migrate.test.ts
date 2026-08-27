import { expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { migrateDatabase } from './migrate';

it('applies every migration and is safe to rerun', async () => {
  const migrationCount = await Effect.runPromise(
    withTestDatabase((database) =>
      Effect.gen(function* () {
        yield* migrateDatabase(database.url);
        yield* migrateDatabase(database.url);
        const sql = yield* Database;
        const rows = yield* sql<{ readonly count: number }>`
          select count(*)::int as count from drizzle.__drizzle_migrations
        `;
        return rows[0]?.count ?? 0;
      }).pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );

  expect(migrationCount).toBeGreaterThan(0);
});
