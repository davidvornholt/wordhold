import { expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
  withTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { Effect } from 'effect';
import {
  DatabaseMigrationError,
  migrateDatabase,
  migrationsFolder,
  placeholderBookName,
} from './migrate';

// The first migrations each replay test applies again.
const importPositionConstraintMigrationHash =
  '18226dcef2d9e932168f3daed465b85680de2d9367e67ab5d0551bc6104954db';
const judgeTargetSynonymsMigrationHash =
  'ddfd5ae1a665a1d614abfe7dcb41bdf704e4fa0bb992ab6e1fa5941c7eabd087';
const staleJudgeVerdictsMigrationHash =
  '89ccf77f492e3d2462345a798f8702b471b92ef8ce2eb282389a8d0696b0ee85';
const migrations = readMigrationFiles({ migrationsFolder });
const migrationCount = migrations.length;
// These tests run the migrations themselves, which takes several seconds on
// a cold hosted runner. Every other test clones the migrated template.
const migrationReplayTimeoutMs = 15_000;

const getMigrationError = (url: string) =>
  Effect.runPromise(migrateDatabase(url).pipe(Effect.flip));

// The migrator applies only migrations newer than the newest recorded one,
// so a replay unrecords the given migration and every later one.
const unrecordMigrationsFrom = (hash: string) =>
  Effect.gen(function* () {
    const first = migrations.find((migration) => migration.hash === hash);
    if (first === undefined) {
      return yield* Effect.die(new Error(`No migration has hash ${hash}.`));
    }
    const sql = yield* Database;
    yield* sql`
      delete from drizzle.__drizzle_migrations
      where created_at >= ${first.folderMillis}
    `;
  });

const countAppliedMigrations = Effect.gen(function* () {
  const sql = yield* Database;
  const rows = yield* sql<{ readonly count: number }>`
    select count(*)::int as count from drizzle.__drizzle_migrations
  `;
  return rows[0]?.count ?? 0;
});

it(
  'applies every migration to an empty database',
  async () => {
    const applied = await Effect.runPromise(
      withTestDatabase((database) =>
        Effect.gen(function* () {
          yield* migrateDatabase(database.url);
          return yield* countAppliedMigrations;
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );

    expect(applied).toBe(migrationCount);
  },
  migrationReplayTimeoutMs,
);

it(
  'replays the final migrations from their pre-DDL state',
  async () => {
    const applied = await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
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
          yield* sql`alter table entries drop column spelling_pitfalls`;
          yield* sql`alter table entries add column grammar jsonb, add column notes text`;
          yield* sql`
          alter table courses
            drop constraint courses_directions_translations,
            drop column practises_related_words
        `;
          // Postgres cannot drop an enum value; renaming one frees its label
          // for the replayed migration to add again.
          yield* sql`alter type answer_direction rename value 'to_synonym' to 'replayed_to_synonym'`;
          yield* sql`alter type answer_direction rename value 'to_antonym' to 'replayed_to_antonym'`;
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
          yield* unrecordMigrationsFrom(importPositionConstraintMigrationHash);
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
          return yield* countAppliedMigrations;
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );

    expect(applied).toBe(migrationCount);
  },
  migrationReplayTimeoutMs,
);

it('files units without a book into one placeholder book per course', async () => {
  const units = await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
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
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
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

it('asks synonyms and antonyms once their word is learned', async () => {
  const cards = await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        const sql = yield* Database;
        yield* sql`
          insert into courses (id, name, target_language)
          values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Englisch', 'en')
        `;
        yield* sql`
          insert into entries (id, course_id, target_text, native_text)
          values
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'happy', 'glücklich'),
            ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'hostile', 'feindselig')
        `;
        // `happy` is learned in both directions; its synonym card waited for
        // a learning pass of its own. `hostile` is not learned, but its
        // relation cards went through that pass, and one has been answered.
        yield* sql`
          insert into cards (entry_id, direction, introduced_at, state)
          values
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'to_target', '2026-01-02T00:00:00Z', 'review'),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'to_native', '2026-01-01T00:00:00Z', 'new'),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'to_synonym', null, 'new'),
            ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'to_target', null, 'new'),
            ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'to_synonym', '2026-01-03T00:00:00Z', 'new'),
            ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'to_antonym', '2026-01-04T00:00:00Z', 'review')
        `;
        yield* migrateDatabase(database.url);
        yield* migrateDatabase(database.url);
        return yield* sql<{
          readonly word: string;
          readonly direction: string;
          readonly introducedAt: string | null;
        }>`
          select entry.target_text as word, card.direction,
            to_char(card.introduced_at at time zone 'UTC', 'YYYY-MM-DD') as "introducedAt"
          from cards as card
          join entries as entry on entry.id = card.entry_id
          where card.direction in ('to_synonym', 'to_antonym')
          order by entry.target_text, card.direction
        `;
      }).pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );

  expect(cards).toEqual([
    { word: 'happy', direction: 'to_synonym', introducedAt: '2026-01-01' },
    { word: 'hostile', direction: 'to_synonym', introducedAt: null },
    { word: 'hostile', direction: 'to_antonym', introducedAt: '2026-01-04' },
  ]);
});

it('drops the synonyms the judge accepted into the target language', async () => {
  const answers = await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        const sql = yield* Database;
        yield* sql`
          insert into courses (id, name, target_language)
          values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Englisch', 'en')
        `;
        yield* sql`
          insert into entries (id, course_id, target_text, native_text)
          values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'adolescent', 'der/die Jugendliche')
        `;
        // Only `teenager` was accepted by the judge in place of the textbook
        // word. A translation into German may still be a synonym.
        yield* sql`
          insert into accepted_answers (entry_id, direction, text, normalized, source)
          values
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'to_target', 'adolescent', 'adolescent', 'textbook'),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'to_target', 'teenager', 'teenager', 'judge'),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'to_target', 'teen', 'teen', 'manual'),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'to_native', 'der Teenager', 'der teenager', 'judge')
        `;
        yield* sql`alter table entries add column grammar jsonb, add column notes text`;
        yield* unrecordMigrationsFrom(judgeTargetSynonymsMigrationHash);
        yield* migrateDatabase(database.url);
        return yield* sql<{
          readonly direction: string;
          readonly text: string;
          readonly source: string;
        }>`
          select direction, text, source from accepted_answers order by text
        `;
      }).pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );

  expect(answers).toEqual([
    { direction: 'to_target', text: 'adolescent', source: 'textbook' },
    { direction: 'to_native', text: 'der Teenager', source: 'judge' },
    { direction: 'to_target', text: 'teen', source: 'manual' },
  ]);
});

it('drops the judge verdicts stored without otherWording', async () => {
  const answers = await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        const sql = yield* Database;
        yield* sql`
          insert into courses (id, name, target_language)
          values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Spanisch', 'es')
        `;
        yield* sql`
          insert into entries (id, course_id, target_text, native_text)
          values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'enfocarse', 'sich konzentrieren')
        `;
        // A definition verdict has no `correct` field and stays.
        yield* sql`
          insert into judge_cache (entry_id, direction, normalized_answer, verdict, model)
          values
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'to_target', 'stale', '{"correct":false}', 'judge'),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'to_target', 'current', '{"correct":false,"otherWording":true}', 'judge'),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'to_native', 'definition', '{"keyPoints":[],"accuracy":{"ok":true,"note":null},"explanation":null}', 'definition')
        `;
        yield* unrecordMigrationsFrom(staleJudgeVerdictsMigrationHash);
        yield* migrateDatabase(database.url);
        return yield* sql<{ readonly answer: string }>`
          select normalized_answer as answer from judge_cache order by normalized_answer
        `;
      }).pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );

  expect(answers).toEqual([{ answer: 'current' }, { answer: 'definition' }]);
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
