import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { PageAlreadyVerifiedError } from '../errors/page-already-verified-error';
import { decodeImportPayload } from '../schemas/import-payload';
import { verifyPageLive } from './verify-page-live';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sessionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const page48Id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const page47Id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const page48Number = 48;
const page47Number = 47;

const extraction = (pageNumber: number) =>
  JSON.stringify({
    modelId: 'test-model',
    page: {
      entries: [],
      overallConfidence: 1,
      pageNumber,
      pageNumberConfidence: 0.99,
    },
  });

const payload = (pageId: string) =>
  decodeImportPayload({
    pageId,
    entries: [
      {
        unit: { kind: 'new', name: 'Unit 1' },
        targetText: 'memory',
        nativeText: 'Erinnerung',
      },
    ],
  });

describe('verifyPageLive review order', () => {
  it('claims only the first printed page in a reliably numbered stack', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          const sql = yield* Database;
          yield* sql`
            insert into courses (id, name, target_language)
            values (${courseId}, 'English', 'en')
          `;
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
              (${page48Id}, ${courseId}, ${sessionId}, 0, 2, 'pages/48.png', ${extraction(page48Number)}::jsonb),
              (${page47Id}, ${courseId}, ${sessionId}, 1, 2, 'pages/47.png', ${extraction(page47Number)}::jsonb)
          `;

          const outOfOrder = yield* Effect.either(
            verifyPageLive(sql, payload(page48Id), courseId),
          );
          expect(outOfOrder).toEqual(
            expect.objectContaining({
              _tag: 'Left',
              left: expect.any(PageAlreadyVerifiedError),
            }),
          );

          const inserted = yield* verifyPageLive(
            sql,
            payload(page47Id),
            courseId,
          );
          expect(inserted).toHaveLength(1);
          const pages = yield* sql<{
            id: string;
            status: 'awaiting_verification' | 'verified';
          }>`select id, status from pages order by import_position`;
          expect(pages).toEqual([
            { id: page48Id, status: 'awaiting_verification' },
            { id: page47Id, status: 'verified' },
          ]);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });
});
