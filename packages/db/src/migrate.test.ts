import { expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { DatabaseMigrationError, migrateDatabase } from './migrate';

// Replay the final migrations from their pre-DDL state.
const importPositionConstraintMigrationHash =
  '18226dcef2d9e932168f3daed465b85680de2d9367e67ab5d0551bc6104954db';
const reviewOrderMigrationHash =
  '3b01f431635ab6d65034133670f39894f3ea9b7710520a3659c4f0e426a092d2';
const reviewPositionMigrationHash =
  '667da7736b64b0656bc94e13aa92a626ee11d920ef4a49b55660274959306df1';
const fullMigrationTestTimeoutMs = 15_000;

const getMigrationError = (url: string) =>
  Effect.runPromise(migrateDatabase(url).pipe(Effect.flip));

it(
  'applies every migration and is safe to rerun',
  async () => {
    const migrationCount = await Effect.runPromise(
      withTestDatabase((database) =>
        Effect.gen(function* () {
          yield* migrateDatabase(database.url);
          const sql = yield* Database;
          yield* sql`
          insert into courses (id, name, target_language)
          values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'English', 'en')
        `;
          yield* sql`
          insert into pages (id, course_id, import_session_id, import_position, import_expected_count, image_path)
          values
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 0, 2, 'pages/one.png'),
            ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 1, 2, 'pages/two.png')
        `;
          yield* sql`alter table pages drop constraint pages_import_position_within_expected_count`;
          yield* sql`
          update pages
          set import_expected_count = 1
          where import_session_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
        `;
          yield* sql`alter table pages drop constraint pages_review_position_non_negative`;
          yield* sql`drop index pages_import_session_review_position_unique`;
          yield* sql`alter table pages drop column review_position`;
          yield* sql`alter table pages drop column review_order`;
          yield* sql`drop type page_review_order`;
          yield* sql`
          delete from drizzle.__drizzle_migrations
          where hash in (
            ${importPositionConstraintMigrationHash},
            ${reviewOrderMigrationHash},
            ${reviewPositionMigrationHash}
          )
        `;
          yield* migrateDatabase(database.url);
          const pages = yield* sql<{ readonly expected: number }>`
          select import_expected_count as expected
          from pages
          where import_session_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
          order by import_position
        `;
          expect(pages).toEqual([{ expected: 2 }, { expected: 2 }]);
          const constraints = yield* sql<{ readonly validated: boolean }>`
          select convalidated as validated
          from pg_constraint
          where conname = 'pages_import_position_within_expected_count'
        `;
          expect(constraints).toEqual([{ validated: true }]);
          const rows = yield* sql<{ readonly count: number }>`
          select count(*)::int as count from drizzle.__drizzle_migrations
        `;
          return rows[0]?.count ?? 0;
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );

    expect(migrationCount).toBeGreaterThan(0);
  },
  fullMigrationTestTimeoutMs,
);

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
