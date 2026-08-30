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
const page46Id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const page49Id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const page49Number = 49;
const page47Number = 47;
const page48Number = 48;
const page46Number = 46;
const changedPage48Number = 99;

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

const extractionWithoutPageNumber = JSON.stringify({
  modelId: 'test-model',
  page: {
    entries: [],
    overallConfidence: 1,
  },
});

const payload = (pageId: string, targetText = 'memory') =>
  decodeImportPayload({
    pageId,
    entries: [
      {
        unit: { kind: 'new', name: 'Unit 1' },
        targetText,
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
              (${page48Id}, ${courseId}, ${sessionId}, 0, 3, 'pages/48.png', ${extraction(page48Number)}::jsonb),
              (${page47Id}, ${courseId}, ${sessionId}, 1, 3, 'pages/47.png', ${extraction(page47Number)}::jsonb),
              (${page49Id}, ${courseId}, ${sessionId}, 2, 3, 'pages/49.png', ${extraction(page49Number)}::jsonb)
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

          const firstInserted = yield* verifyPageLive(
            sql,
            payload(page47Id, 'first'),
            courseId,
          );
          expect(firstInserted).toHaveLength(1);

          yield* sql`
            update pages
            set extraction = ${extraction(changedPage48Number)}::jsonb
            where id = ${page48Id}
              and status = 'awaiting_verification'
          `;

          const nextInserted = yield* verifyPageLive(
            sql,
            payload(page48Id, 'second'),
            courseId,
          );
          expect(nextInserted).toHaveLength(1);

          const pages = yield* sql<{
            id: string;
            reviewOrder: 'page_number' | 'scan' | null;
            reviewPosition: number | null;
            status: 'awaiting_verification' | 'verified';
          }>`
            select id,
              review_order as "reviewOrder",
              review_position as "reviewPosition",
              status
            from pages
            order by import_position
          `;
          expect(pages).toEqual([
            {
              id: page48Id,
              reviewOrder: 'page_number',
              reviewPosition: 1,
              status: 'verified',
            },
            {
              id: page47Id,
              reviewOrder: 'page_number',
              reviewPosition: 0,
              status: 'verified',
            },
            {
              id: page49Id,
              reviewOrder: 'page_number',
              reviewPosition: 2,
              status: 'awaiting_verification',
            },
          ]);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });

  it('freezes scan order when a missing page number arrives after review starts', async () => {
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
              (${page48Id}, ${courseId}, ${sessionId}, 0, 3, 'pages/48.png', ${extraction(page48Number)}::jsonb),
              (${page47Id}, ${courseId}, ${sessionId}, 1, 3, 'pages/47.png', ${extractionWithoutPageNumber}::jsonb),
              (${page46Id}, ${courseId}, ${sessionId}, 2, 3, 'pages/46.png', ${extraction(page46Number)}::jsonb)
          `;

          const firstInserted = yield* verifyPageLive(
            sql,
            payload(page48Id, 'first'),
            courseId,
          );
          expect(firstInserted).toHaveLength(1);

          yield* sql`
            update pages
            set extraction = ${extraction(page47Number)}::jsonb
            where id = ${page47Id}
              and status = 'awaiting_verification'
          `;

          const secondInserted = yield* verifyPageLive(
            sql,
            payload(page47Id, 'second'),
            courseId,
          );
          expect(secondInserted).toHaveLength(1);

          const pages = yield* sql<{
            id: string;
            reviewOrder: 'page_number' | 'scan' | null;
            status: 'awaiting_verification' | 'verified';
          }>`
            select id,
              review_order as "reviewOrder",
              status
            from pages
            where import_session_id = ${sessionId}
            order by import_position
          `;
          expect(pages).toEqual([
            { id: page48Id, reviewOrder: 'scan', status: 'verified' },
            { id: page47Id, reviewOrder: 'scan', status: 'verified' },
            {
              id: page46Id,
              reviewOrder: 'scan',
              status: 'awaiting_verification',
            },
          ]);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });
});
