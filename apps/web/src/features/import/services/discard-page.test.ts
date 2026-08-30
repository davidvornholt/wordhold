import { expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { Storage } from '../../../shared/storage/server';
import { StorageError } from '../../../shared/storage/storage-error';
import { PageNotPendingError } from '../errors/page-not-pending-error';
import { discardPendingImportSession } from './discard-page';
import { ImportRepository } from './repository';
import { ImportRepositoryLive } from './repository-live';
import { makeStorage } from './test-services';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const pendingPageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const verifiedPageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const importSessionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

it('deletes the open pages in one import session and keeps verified pages', async () => {
  await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        const sql = yield* Database;
        const repository = yield* ImportRepository;
        yield* sql`
          insert into courses (id, name, target_language)
          values (${courseId}, 'English', 'en')
        `;
        yield* sql`
          insert into pages (id, course_id, import_session_id, import_position, import_expected_count, image_path, status, verified_at)
          values
            (${pendingPageId}, ${courseId}, ${importSessionId}, 0, 2, 'pages/pending.png', 'awaiting_verification', null),
            (${verifiedPageId}, ${courseId}, ${importSessionId}, 1, 2, 'pages/verified.png', 'verified', now())
        `;

        const removed: Array<string> = [];
        const storage = makeStorage({
          remove: (path) =>
            Effect.sync(() => {
              removed.push(path);
            }).pipe(
              Effect.zipRight(
                Effect.fail(
                  new StorageError({
                    operation: 'remove file',
                    cause: new Error('disk unavailable'),
                    message: 'disk unavailable',
                  }),
                ),
              ),
            ),
        });
        const discard = (sessionId: string) =>
          discardPendingImportSession(sessionId).pipe(
            Effect.provideService(Storage, storage),
            Effect.provide(ImportRepositoryLive),
          );

        expect(yield* discard(importSessionId)).toEqual({
          cleanupPending: true,
        });
        expect(removed).toEqual(['pages/pending.png']);

        const verifiedResult = yield* Effect.either(discard(importSessionId));
        expect(verifiedResult).toEqual(
          expect.objectContaining({
            _tag: 'Left',
            left: expect.any(PageNotPendingError),
          }),
        );
        expect(removed).toEqual(['pages/pending.png']);

        const remaining = yield* sql<{ readonly id: string }>`
          select id from pages order by id
        `;
        expect(remaining).toEqual([{ id: verifiedPageId }]);

        const tombstones = yield* sql<{ readonly id: string }>`
          select id from import_session_tombstones
          where id = ${importSessionId}
        `;
        expect(tombstones).toEqual([{ id: importSessionId }]);

        const lateUpload = yield* Effect.either(
          repository.insertPage({
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            courseId,
            importSessionId,
            importPosition: 0,
            importExpectedCount: 1,
            imagePath: 'pages/late.png',
          }),
        );
        expect(lateUpload).toEqual(
          expect.objectContaining({
            _tag: 'Left',
            left: expect.objectContaining({
              message: 'Database operation failed: insert page.',
            }),
          }),
        );
      }).pipe(
        Effect.provide(ImportRepositoryLive),
        Effect.provide(testDatabaseLayer(database.url)),
      ),
    ),
  );
});
