import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { DuplicateEntryError } from '../errors/duplicate-entry-error';
import { decodeImportPayload } from '../schemas/import-payload';
import { verifyPageLive } from './verify-page-live';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const pageIds = [
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
] as const;

const entry = (targetText: string, extras: Record<string, unknown> = {}) => ({
  unit: { kind: 'new' as const, name: 'Unit 3' },
  targetText,
  nativeText: 'Erinnerung',
  ...extras,
});

const seedCourse = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, name, target_language)
    values (${courseId}, 'French', 'fr')
  `;
  yield* sql`
    insert into pages (id, course_id, image_path)
    values
      (${pageIds[0]}, ${courseId}, 'first.png'),
      (${pageIds[1]}, ${courseId}, 'second.png'),
      (${pageIds[2]}, ${courseId}, 'third.png')
  `;
});

const importEntries = (
  pageId: string,
  entries: ReadonlyArray<Record<string, unknown>>,
) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    return yield* Effect.either(
      verifyPageLive(sql, decodeImportPayload({ pageId, entries }), courseId),
    );
  });

const entryCount = Effect.gen(function* () {
  const sql = yield* Database;
  const rows = yield* sql<{ readonly count: number }>`
    select count(*)::integer as count from entries
  `;
  return rows[0]?.count;
});

const originalPlusTwoExceptions = 3;

describe('verifyPageLive duplicates', () => {
  it('rejects a re-scan of the same words and leaves the page unclaimed', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* seedCourse;
          yield* importEntries(pageIds[0], [entry('mémoire')]);
          const rescan = yield* importEntries(pageIds[1], [
            entry('  mémoire!! '),
            entry('livre'),
          ]);
          expect(rescan._tag).toBe('Left');
          expect(rescan._tag === 'Left' ? rescan.left : null).toBeInstanceOf(
            DuplicateEntryError,
          );
          const sql = yield* Database;
          const pages = yield* sql<{ readonly status: string }>`
            select status from pages where id = ${pageIds[1]}
          `;
          expect(pages[0]?.status).toBe('awaiting_verification');
          expect(yield* entryCount).toBe(1);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });

  it('imports a casing or example variant only as a confirmed exception', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* seedCourse;
          yield* importEntries(pageIds[0], [
            entry('mémoire', { example: 'Une bonne mémoire.' }),
          ]);
          const unconfirmed = yield* importEntries(pageIds[1], [
            entry('Mémoire', { example: 'Une bonne mémoire.' }),
          ]);
          expect(unconfirmed._tag).toBe('Left');
          const casingVariant = yield* importEntries(pageIds[1], [
            entry('Mémoire', {
              example: 'Une bonne mémoire.',
              duplicateException: true,
            }),
          ]);
          expect(casingVariant._tag).toBe('Right');
          const exampleVariant = yield* importEntries(pageIds[2], [
            entry('mémoire', {
              example: 'La mémoire humaine.',
              duplicateException: true,
            }),
          ]);
          expect(exampleVariant._tag).toBe('Right');
          expect(yield* entryCount).toBe(originalPlusTwoExceptions);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });

  it('refuses to confirm an exact duplicate even with consent', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* seedCourse;
          yield* importEntries(pageIds[0], [entry('mémoire')]);
          const rescan = yield* importEntries(pageIds[1], [
            entry('mémoire', { duplicateException: true }),
          ]);
          expect(rescan._tag).toBe('Left');
          expect(yield* entryCount).toBe(1);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });

  it('rejects one page listing the same word twice', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* seedCourse;
          const doubled = yield* importEntries(pageIds[0], [
            entry('mémoire'),
            entry('mémoire.'),
          ]);
          expect(doubled._tag).toBe('Left');
          expect(
            doubled._tag === 'Left' &&
              doubled.left instanceof DuplicateEntryError
              ? doubled.left.duplicates
              : [],
          ).toEqual(['mémoire.']);
          expect(yield* entryCount).toBe(0);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });
});
