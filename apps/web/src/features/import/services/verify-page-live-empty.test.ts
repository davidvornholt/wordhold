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

const verify = (
  pageId: string,
  entries: ReadonlyArray<Record<string, unknown>>,
) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    return yield* Effect.either(
      verifyPageLive(sql, decodeImportPayload({ pageId, entries }), courseId),
    );
  });

describe('verifyPageLive duplicate-only pages', () => {
  it('claims an all-duplicate page without inserting another entry', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* seedCourse;
          yield* verify(pageIds[0], [entry('mémoire')]);
          const skipped = yield* verify(pageIds[1], [
            entry('mémoire', { skipDuplicate: true }),
          ]);
          expect(skipped._tag).toBe('Right');

          const invalidSkip = yield* verify(pageIds[2], [
            entry('livre', { skipDuplicate: true }),
          ]);
          expect(invalidSkip._tag).toBe('Left');
          expect(
            invalidSkip._tag === 'Left' ? invalidSkip.left : undefined,
          ).toBeInstanceOf(DuplicateEntryError);

          const sql = yield* Database;
          const pages = yield* sql<{
            readonly id: string;
            readonly status: string;
          }>`
            select id, status from pages where id in (${pageIds[1]}, ${pageIds[2]}) order by id
          `;
          expect(pages).toEqual([
            { id: pageIds[1], status: 'verified' },
            { id: pageIds[2], status: 'awaiting_verification' },
          ]);
          const entries = yield* sql<{ readonly count: number }>`
            select count(*)::integer as count from entries
          `;
          expect(entries[0]?.count).toBe(1);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });
});
