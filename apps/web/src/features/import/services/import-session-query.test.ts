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
              import_expected_count,
              image_path,
              extraction,
              status,
              verified_at
            ) values
              ('11111111-1111-4111-8111-111111111111', ${courseId}, ${sessionId}, 0, 2, 'pages/one.png', '{}'::jsonb, 'awaiting_verification', null),
              ('22222222-2222-4222-8222-222222222222', ${courseId}, ${sessionId}, 1, 2, 'pages/two.png', '{}'::jsonb, 'verified', now()),
              ('33333333-3333-4333-8333-333333333333', ${courseId}, ${completedSessionId}, 0, 1, 'pages/three.png', '{}'::jsonb, 'verified', now())
          `;

          const repository = yield* ImportRepository;
          const pending = yield* repository.listPendingImportSessions;
          expect(pending).toEqual([
            expect.objectContaining({
              id: sessionId,
              courseName: 'Französisch',
              pageCount: 2,
              uploadedCount: 2,
              verifiedCount: 1,
              pendingCount: 1,
              isComplete: true,
            }),
          ]);

          const session = yield* repository.getImportSession(sessionId);
          expect(session).toEqual(
            expect.objectContaining({
              id: sessionId,
              pages: [
                expect.objectContaining({ position: 1, status: 'verified' }),
                expect.objectContaining({
                  position: 0,
                  status: 'awaiting_verification',
                }),
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

  it('accepts a retry of the same page upload without duplicating it', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          const sql = yield* Database;
          yield* sql`
            insert into courses (id, name, target_language)
            values (${courseId}, 'Französisch', 'fr')
          `;
          const repository = yield* ImportRepository;
          const input = {
            id: '44444444-4444-4444-8444-444444444444',
            courseId,
            importSessionId: sessionId,
            importPosition: 0,
            importExpectedCount: 2,
            imagePath: 'pages/retry.png',
          } as const;
          yield* repository.insertPage(input);
          yield* repository.insertPage(input);

          const session = yield* repository.getImportSession(sessionId);
          expect(session).toEqual(
            expect.objectContaining({
              expectedPageCount: 2,
              isComplete: false,
              pages: [
                expect.objectContaining({
                  id: input.id,
                  position: input.importPosition,
                }),
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

describe('import session review order', () => {
  it('returns a reliably numbered stack in printed page order', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          const sql = yield* Database;
          yield* sql`
            insert into courses (id, name, target_language)
            values (${courseId}, 'Französisch', 'fr')
          `;
          const page48 = JSON.stringify({
            modelId: 'test-model',
            page: {
              entries: [],
              overallConfidence: 1,
              pageNumber: 48,
              pageNumberConfidence: 0.99,
            },
          });
          const page47 = JSON.stringify({
            modelId: 'test-model',
            page: {
              entries: [],
              overallConfidence: 1,
              pageNumber: 47,
              pageNumberConfidence: 0.98,
            },
          });
          yield* sql`
            insert into pages (
              id,
              course_id,
              import_session_id,
              import_position,
              import_expected_count,
              image_path,
              extraction
            ) values
              ('11111111-1111-4111-8111-111111111111', ${courseId}, ${sessionId}, 0, 2, 'pages/48.png', ${page48}::jsonb),
              ('22222222-2222-4222-8222-222222222222', ${courseId}, ${sessionId}, 1, 2, 'pages/47.png', ${page47}::jsonb)
          `;

          const repository = yield* ImportRepository;
          const session = yield* repository.getImportSession(sessionId);

          expect(session?.reviewOrder).toBe('page_number');
          expect(
            session?.pages.map(({ id, pageNumber, position }) => ({
              id,
              pageNumber,
              position,
            })),
          ).toEqual([
            {
              id: '22222222-2222-4222-8222-222222222222',
              pageNumber: 47,
              position: 1,
            },
            {
              id: '11111111-1111-4111-8111-111111111111',
              pageNumber: 48,
              position: 0,
            },
          ]);
        }).pipe(
          Effect.provide(ImportRepositoryLive),
          Effect.provide(testDatabaseLayer(database.url)),
        ),
      ),
    );
  });
});
