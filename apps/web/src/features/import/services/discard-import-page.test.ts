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
const queuedPageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5';

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
        // The browser sends its queue, in position order, before the removal.
        const discard = (
          pageId: string,
          position: number,
          queue: ReadonlyArray<string>,
        ) =>
          discardPendingImportPage({
            courseId,
            importSessionId,
            pageId,
            position,
            queue: queue.map((id, index) => ({ pageId: id, position: index })),
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

        expect(
          yield* discard(failedPageId, 1, [
            firstPageId,
            failedPageId,
            secondPageId,
            lastPageId,
            unstoredPageId,
          ]),
        ).toEqual({
          cleanupPending: false,
        });
        expect(removed).toEqual(['pages/failed.jpg']);
        expect(yield* batch).toEqual([
          { id: firstPageId, position: 0, expected: 4 },
          { id: secondPageId, position: 1, expected: 4 },
          { id: lastPageId, position: 2, expected: 4 },
        ]);

        // The unstored photo moved up to position 3 in the queue as well.
        expect(
          yield* discard(unstoredPageId, 3, [
            firstPageId,
            secondPageId,
            lastPageId,
            unstoredPageId,
          ]),
        ).toEqual({
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

        const mismatch = yield* Effect.flip(
          discard(lastPageId, 0, [firstPageId, secondPageId, lastPageId]),
        );
        expect(mismatch).toBeInstanceOf(ImportDatabaseError);
        expect(yield* batch).toHaveLength(3);

        yield* sql`update pages set status = 'verified', verified_at = now() where id = ${firstPageId}`;
        const reviewed = yield* Effect.flip(
          discard(lastPageId, 2, [firstPageId, secondPageId, lastPageId]),
        );
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

it('treats a retried removal as done when its first response was lost', async () => {
  await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        const sql = yield* Database;
        const repository = yield* ImportRepository;
        yield* sql`
          insert into courses (id, name, target_language)
          values (${courseId}, 'English', 'en')
        `;
        // Five photos: the first three are stored, and the last two never
        // reached the server.
        yield* sql`
          insert into pages (id, course_id, import_session_id, import_position, import_expected_count, image_path)
          values
            (${firstPageId}, ${courseId}, ${importSessionId}, 0, 5, 'pages/first.jpg'),
            (${secondPageId}, ${courseId}, ${importSessionId}, 1, 5, 'pages/second.jpg'),
            (${lastPageId}, ${courseId}, ${importSessionId}, 2, 5, 'pages/last.jpg')
        `;
        const removed: Array<string> = [];
        const storage = makeStorage({
          remove: (path) =>
            Effect.sync(() => {
              removed.push(path);
            }),
        });
        // The browser sends its queue, in position order, before the removal.
        const discard = (
          pageId: string,
          position: number,
          queue: ReadonlyArray<string>,
        ) =>
          discardPendingImportPage({
            courseId,
            importSessionId,
            pageId,
            position,
            queue: queue.map((id, index) => ({ pageId: id, position: index })),
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

        // The browser keeps a page whose removal response did not arrive and
        // sends the same removal again.
        const fivePhotos = [
          firstPageId,
          secondPageId,
          lastPageId,
          queuedPageId,
          unstoredPageId,
        ];
        yield* discard(unstoredPageId, 4, fivePhotos);
        yield* discard(unstoredPageId, 4, fivePhotos);
        const fourPhotos = [
          firstPageId,
          secondPageId,
          lastPageId,
          queuedPageId,
        ];
        yield* discard(secondPageId, 1, fourPhotos);
        expect(yield* discard(secondPageId, 1, fourPhotos)).toEqual({
          cleanupPending: false,
        });
        expect(removed).toEqual(['pages/second.jpg']);
        expect(yield* batch).toEqual([
          { id: firstPageId, position: 0, expected: 3 },
          { id: lastPageId, position: 1, expected: 3 },
        ]);
        const session = yield* repository.getImportSession(importSessionId);
        expect(session?.isComplete).toBe(false);

        // A queue whose batch size disagrees with the server's changes nothing.
        const stale = yield* Effect.flip(discard(lastPageId, 1, fivePhotos));
        expect(stale).toBeInstanceOf(ImportDatabaseError);
        expect(yield* batch).toHaveLength(2);
      }).pipe(
        Effect.provide(ImportRepositoryLive),
        Effect.provide(testDatabaseLayer(database.url)),
      ),
    ),
  );
});

it('refuses a removal that only looks like a repeat after another one committed', async () => {
  await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        const sql = yield* Database;
        yield* sql`
          insert into courses (id, name, target_language)
          values (${courseId}, 'English', 'en')
        `;
        // Four photos: the first and third are stored.
        yield* sql`
          insert into pages (id, course_id, import_session_id, import_position, import_expected_count, image_path)
          values
            (${firstPageId}, ${courseId}, ${importSessionId}, 0, 4, 'pages/first.jpg'),
            (${secondPageId}, ${courseId}, ${importSessionId}, 2, 4, 'pages/second.jpg')
        `;
        const discard = (
          pageId: string,
          position: number,
          queue: ReadonlyArray<string>,
        ) =>
          discardPendingImportPage({
            courseId,
            importSessionId,
            pageId,
            position,
            queue: queue.map((id, index) => ({ pageId: id, position: index })),
          }).pipe(
            Effect.provideService(Storage, makeStorage()),
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
        const fourPhotos = [
          firstPageId,
          failedPageId,
          secondPageId,
          unstoredPageId,
        ];

        // The first photo's removal commits, but its response is lost, so the
        // browser still shows all four photos.
        yield* discard(firstPageId, 0, fourPhotos);
        // Removing the last photo now is not a repeat of anything.
        const unrelated = yield* Effect.flip(
          discard(unstoredPageId, 3, fourPhotos),
        );
        expect(unrelated).toBeInstanceOf(ImportDatabaseError);
        // Retrying the first removal is, and the queue then matches the batch.
        expect(yield* discard(firstPageId, 0, fourPhotos)).toEqual({
          cleanupPending: false,
        });
        expect(yield* discard(unstoredPageId, 2, fourPhotos.slice(1))).toEqual({
          cleanupPending: false,
        });
        expect(yield* batch).toEqual([
          { id: secondPageId, position: 1, expected: 2 },
        ]);
      }).pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );
});
