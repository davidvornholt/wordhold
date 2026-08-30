import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { ImportRepository } from './repository';
import { ImportRepositoryLive } from './repository-live';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sessionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const completedSessionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('import sessions', () => {
  it('groups a captured batch and lists only sessions with open pages', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          const sql = yield* Database;
          yield* sql`
            insert into courses (id, name, target_language)
            values (${courseId}, 'Französisch', 'fr')
          `;
          yield* sql`
            insert into pages (
              id,
              course_id,
              import_session_id,
              import_position,
              image_path,
              extraction,
              status,
              verified_at
            ) values
              ('11111111-1111-4111-8111-111111111111', ${courseId}, ${sessionId}, 0, 'pages/one.png', '{}'::jsonb, 'awaiting_verification', null),
              ('22222222-2222-4222-8222-222222222222', ${courseId}, ${sessionId}, 1, 'pages/two.png', '{}'::jsonb, 'verified', now()),
              ('33333333-3333-4333-8333-333333333333', ${courseId}, ${completedSessionId}, 0, 'pages/three.png', '{}'::jsonb, 'verified', now())
          `;

          const repository = yield* ImportRepository;
          const pending = yield* repository.listPendingImportSessions;
          expect(pending).toEqual([
            expect.objectContaining({
              id: sessionId,
              courseName: 'Französisch',
              pageCount: 2,
              pendingCount: 1,
            }),
          ]);

          const session = yield* repository.getImportSession(sessionId);
          expect(session).toEqual(
            expect.objectContaining({
              id: sessionId,
              pages: [
                expect.objectContaining({
                  position: 0,
                  status: 'awaiting_verification',
                }),
                expect.objectContaining({ position: 1, status: 'verified' }),
              ],
            }),
          );
        }).pipe(
          Effect.provide(ImportRepositoryLive),
          Effect.provide(testDatabaseLayer(database.url)),
        ),
      ),
    );
  });
});
