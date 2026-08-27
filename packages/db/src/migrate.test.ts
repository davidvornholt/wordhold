import { expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { DatabaseMigrationError, migrateDatabase } from './migrate';

const getMigrationError = (url: string) =>
  Effect.runPromise(migrateDatabase(url).pipe(Effect.flip));

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

it('reports a malformed database URL as a typed migration error', async () => {
  const error = await getMigrationError('not a database URL');

  expect(error).toBeInstanceOf(DatabaseMigrationError);
  expect(error).toEqual(
    expect.objectContaining({
      _tag: 'DatabaseMigrationError',
      message: 'Could not apply the Wordhold database migrations.',
    }),
  );
});

it('reports an unreachable database as a typed migration error', async () => {
  const error = await getMigrationError(
    'postgres://postgres:postgres@127.0.0.1:1/wordhold?connect_timeout=1',
  );

  expect(error).toBeInstanceOf(DatabaseMigrationError);
  expect(error).toEqual(
    expect.objectContaining({
      _tag: 'DatabaseMigrationError',
      message: 'Could not apply the Wordhold database migrations.',
    }),
  );
});
