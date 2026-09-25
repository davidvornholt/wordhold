import { expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import {
  DatabaseMigrationError,
  migrateDatabase,
  placeholderBookName,
} from './migrate';

// Replay the final migrations from their pre-DDL state.
const importPositionConstraintMigrationHash =
  '18226dcef2d9e932168f3daed465b85680de2d9367e67ab5d0551bc6104954db';
const reviewOrderMigrationHash =
  '3b01f431635ab6d65034133670f39894f3ea9b7710520a3659c4f0e426a092d2';
const reviewPositionMigrationHash =
  '667da7736b64b0656bc94e13aa92a626ee11d920ef4a49b55660274959306df1';
const exampleAudioMigrationHash =
  'aface4b435b2dafbc5c9edefed79481429abecc375d5cd26d416759672671b24';
const booksMigrationHash =
  '6cc265987ae1824f43fac61dc5cf25089f1d948265afab509f63a33169ff0538';
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
          yield* sql`alter table entry_examples drop constraint entry_examples_audio_complete`;
          yield* sql`alter table entry_examples drop column audio_profile`;
          yield* sql`alter table entry_examples drop column audio_path`;
          yield* sql`alter table units drop column book_id`;
          yield* sql`drop table books`;
          yield* sql`create unique index units_course_name on units (course_id, name)`;
          yield* sql`create unique index units_course_position on units (course_id, position)`;
          yield* sql`
          delete from drizzle.__drizzle_migrations
          where hash in (
            ${importPositionConstraintMigrationHash},
            ${reviewOrderMigrationHash},
            ${reviewPositionMigrationHash},
            ${exampleAudioMigrationHash},
            ${booksMigrationHash}
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

it('files units without a book into one placeholder book per course', async () => {
  const units = await Effect.runPromise(
    withTestDatabase((database) =>
      Effect.gen(function* () {
        yield* migrateDatabase(database.url);
        const sql = yield* Database;
        yield* sql`
          insert into courses (id, name, target_language)
          values
            ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Spanisch', 'es'),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Englisch', 'en')
        `;
        yield* sql`
          insert into units (course_id, name, position)
          values
            ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'U1 Acércate', 0),
            ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'U2 Descubre', 1),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Unit 1', 0)
        `;
        yield* migrateDatabase(database.url);
        yield* migrateDatabase(database.url);
        return yield* sql<{
          readonly unit: string;
          readonly book: string;
          readonly courseName: string;
        }>`
          select unit.name as unit, book.name as book, course.name as "courseName"
          from units as unit
          join books as book
            on book.id = unit.book_id and book.course_id = unit.course_id
          join courses as course on course.id = unit.course_id
          order by course.name, unit.position
        `;
      }).pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );

  expect(units).toEqual([
    { unit: 'Unit 1', book: placeholderBookName, courseName: 'Englisch' },
    { unit: 'U1 Acércate', book: placeholderBookName, courseName: 'Spanisch' },
    { unit: 'U2 Descubre', book: placeholderBookName, courseName: 'Spanisch' },
  ]);
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
