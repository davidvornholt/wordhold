import { expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { ImportDatabaseError } from '../errors/import-database-error';
import { PageNotPendingError } from '../errors/page-not-pending-error';
import { discardPendingImportPage } from './discard-page';
import { ImportRepository } from './repository';
import { ImportRepositoryLive } from './repository-live';
import { makeStorage } from './test-services';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const importSessionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const firstPageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0';
const failedPageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const secondPageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const lastPageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';
const unstoredPageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4';

it('takes stored and unstored pages out of a batch and keeps it completable', async () => {
  await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        const sql = yield* Database;
        const repository = yield* ImportRepository;
        yield* sql`
          insert into courses (id, name, target_language)
          values (${courseId}, 'English', 'en')
        `;
        // Five photos: the second could not be read and the fifth never
        // reached the server.
        yield* sql`
          insert into pages (id, course_id, import_session_id, import_position, import_expected_count, image_path)
          values
            (${firstPageId}, ${courseId}, ${importSessionId}, 0, 5, 'pages/first.jpg'),
            (${failedPageId}, ${courseId}, ${importSessionId}, 1, 5, 'pages/failed.jpg'),
            (${secondPageId}, ${courseId}, ${importSessionId}, 2, 5, 'pages/second.jpg'),
            (${lastPageId}, ${courseId}, ${importSessionId}, 3, 5, 'pages/last.jpg')
        `;

        const removed: Array<string> = [];
        const storage = makeStorage({
          remove: (path) =>
            Effect.sync(() => {
              removed.push(path);
            }),
        });
        const discard = (pageId: string, position: number) =>
          discardPendingImportPage({
            courseId,
            importSessionId,
            pageId,
            position,
          }).pipe(
            Effect.provideService(Storage, storage),
            Effect.provide(ImportRepositoryLive),
          );
        const batch = sql<{
          readonly id: string;
          readonly position: number;
          readonly expected: number;
        }>`
          select id, import_position as position, import_expected_count as expected
          from pages where import_session_id = ${importSessionId}
          order by import_position
        `;

        expect(yield* discard(failedPageId, 1)).toEqual({
          cleanupPending: false,
        });
        expect(removed).toEqual(['pages/failed.jpg']);
        expect(yield* batch).toEqual([
          { id: firstPageId, position: 0, expected: 4 },
          { id: secondPageId, position: 1, expected: 4 },
          { id: lastPageId, position: 2, expected: 4 },
        ]);

        // The unstored photo moved up to position 3 in the queue as well.
        expect(yield* discard(unstoredPageId, 3)).toEqual({
          cleanupPending: false,
        });
        expect(removed).toEqual(['pages/failed.jpg']);
        expect(yield* batch).toEqual([
          { id: firstPageId, position: 0, expected: 3 },
          { id: secondPageId, position: 1, expected: 3 },
          { id: lastPageId, position: 2, expected: 3 },
        ]);
        const session = yield* repository.getImportSession(importSessionId);
        expect(session?.isComplete).toBe(true);

        const mismatch = yield* Effect.flip(discard(lastPageId, 0));
        expect(mismatch).toBeInstanceOf(ImportDatabaseError);
        expect(yield* batch).toHaveLength(3);

        yield* sql`update pages set status = 'verified', verified_at = now() where id = ${firstPageId}`;
        const reviewed = yield* Effect.flip(discard(lastPageId, 2));
        expect(reviewed).toBeInstanceOf(PageNotPendingError);
        expect(yield* batch).toHaveLength(3);
        expect(removed).toEqual(['pages/failed.jpg']);
      }).pipe(
        Effect.provide(ImportRepositoryLive),
        Effect.provide(testDatabaseLayer(database.url)),
      ),
    ),
  );
});
