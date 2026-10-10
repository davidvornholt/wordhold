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
const accountIdentityMigrationHash =
  '2d232a381883d666ddcdff21161b303eb8c2e0b4bc4576085c55ee0977914ae8';
const unitBookIndexMigrationHash =
  'cb42bc24512d3f6a940f361c3af4bf685acbc113f3bf980841b93260c11cf941';
const entryBookMigrationHash =
  '872071c0a1725aa0d740405e071d8905bcbe7ecfe394a84ac3eda36698bb00e6';
const courseKindMigrationHash =
  'b26fe74cf27edc2b2519861de4384dc66e43010d89be9fd629d03935959863af';
const accountsMigrationHash =
  '11807e707f9b69fa911f86330be224490e390025efec6354bf5888a82841d1c6';
const textsKindMigrationHash =
  'aa594d379bfe20233c70c96f1aeacb742b377fec7169f18cc9d7a7a4d0fb42c4';
const biblesMigrationHash =
  '3bdb05eb80984f57fc406e8b7ef18bf8c552b83ba38252a978b75d7afd11ca2f';
const transcriptionUsageMigrationHash =
  'b01829ba1894314d9860d5ba5cfb9c019b77f3beaeed39493692d313aba79e37';
const relatedWordsMigrationHash =
  '4549fe65b6fcf021610e4fddb0bfd22b3fb65783a8d2c576e2786ec65750d456';
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
          yield* sql`drop table bible_verses, bibles`;
          yield* sql`drop table ai_usage, access_codes, members, passkey`;
          yield* sql`drop type ai_usage_status, ai_provider, access_code_kind`;
          yield* sql`alter table courses drop column owner_id`;
          yield* sql`alter table courses drop constraint courses_list_shape`;
          yield* sql`alter table courses drop column kind`;
          yield* sql`drop type course_kind`;
          yield* sql`alter table entries drop column key_points`;
          yield* sql`alter table entries drop column synonyms, drop column antonyms`;
          yield* sql`drop index "account_providerId_accountId_idx"`;
          yield* sql`alter table account alter column issuer set not null`;
          yield* sql`create unique index "account_issuer_accountId_idx" on account (issuer, account_id)`;
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
          yield* sql`alter table entries drop constraint entries_unit_book_units_id_book_fk`;
          yield* sql`alter table entries drop constraint entries_book_course_books_id_course_fk`;
          yield* sql`alter table entries drop column book_id`;
          yield* sql`alter table entries alter column unit_id set not null`;
          yield* sql`
          alter table entries add constraint entries_unit_course_units_id_course_fk
          foreign key (unit_id, course_id) references units (id, course_id) on delete restrict
        `;
          yield* sql`drop index units_id_book`;
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
            ${booksMigrationHash},
            ${accountIdentityMigrationHash},
            ${unitBookIndexMigrationHash},
            ${entryBookMigrationHash},
            ${courseKindMigrationHash},
            ${accountsMigrationHash},
            ${textsKindMigrationHash},
            ${biblesMigrationHash},
            ${transcriptionUsageMigrationHash},
            ${relatedWordsMigrationHash}
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

it("files entries without a book into their unit's book", async () => {
  const entries = await Effect.runPromise(
    withTestDatabase((database) =>
      Effect.gen(function* () {
        yield* migrateDatabase(database.url);
        const sql = yield* Database;
        yield* sql`
          insert into courses (id, name, target_language)
          values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Spanisch', 'es')
        `;
        yield* sql`
          insert into books (id, course_id, name, position)
          values
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Encuentros 2', 0),
            ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Encuentros 3', 1)
        `;
        yield* sql`
          insert into units (id, course_id, book_id, name, position)
          values
            ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'U1', 0),
            ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'U1', 0)
        `;
        yield* sql`
          insert into entries (course_id, unit_id, target_text, native_text)
          values
            ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'el libro', 'das Buch'),
            ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'la casa', 'das Haus')
        `;
        yield* migrateDatabase(database.url);
        yield* migrateDatabase(database.url);
        return yield* sql<{
          readonly word: string;
          readonly book: string;
        }>`
          select entry.target_text as word, book.name as book
          from entries as entry
          join books as book on book.id = entry.book_id
          order by entry.target_text
        `;
      }).pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );

  expect(entries).toEqual([
    { word: 'el libro', book: 'Encuentros 2' },
    { word: 'la casa', book: 'Encuentros 3' },
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
