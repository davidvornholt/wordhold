import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { UnitNotFoundError } from '../errors/unit-not-found-error';
import { decodeImportPayload } from '../schemas/import-payload';
import { verifyPageLive } from './verify-page-live';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherCourseId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const pageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const staleUnitId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const selectedEntry = (unitId: string) => ({
  unit: { kind: 'existing' as const, unitId },
  type: 'word' as const,
  targetText: 'mémoire',
  nativeText: 'Erinnerung',
});

const seed = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, name, target_language)
    values
      (${courseId}, 'French', 'fr'),
      (${otherCourseId}, 'English', 'en')
  `;
  yield* sql`
    insert into pages (id, course_id, image_path)
    values (${pageId}, ${courseId}, 'page.png')
  `;
  return yield* sql<{ readonly id: string }>`
    insert into units (course_id, name, position)
    values (${otherCourseId}, 'Unit 1', 0)
    returning id
  `;
});

describe('verifyPageLive integrity', () => {
  it('rejects stale and cross-course unit IDs without claiming the page', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          const otherUnits = yield* seed;
          const sql = yield* Database;
          for (const unitId of [staleUnitId, otherUnits[0]?.id ?? '']) {
            const result = yield* Effect.either(
              verifyPageLive(
                sql,
                decodeImportPayload({
                  pageId,
                  entries: [selectedEntry(unitId)],
                }),
                courseId,
              ),
            );
            expect(result).toEqual(
              expect.objectContaining({
                _tag: 'Left',
                left: expect.any(UnitNotFoundError),
              }),
            );
          }
          const pages = yield* sql<{
            readonly status: string;
            readonly entryCount: number;
          }>`
            select pages.status,
              count(entries.id)::integer as "entryCount"
            from pages
            left join entries on entries.page_id = pages.id
            where pages.id = ${pageId}
            group by pages.id
          `;
          expect(pages[0]).toEqual({
            status: 'awaiting_verification',
            entryCount: 0,
          });
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });

  it('rolls back a resolved new unit when a child insert fails', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* seed;
          const sql = yield* Database;
          yield* sql`
            create function reject_card_insert() returns trigger
            language plpgsql as 'begin raise exception ''forced card failure''; end'
          `;
          yield* sql`
            create trigger reject_card_insert
            before insert on cards
            for each statement execute function reject_card_insert()
          `;
          const result = yield* Effect.either(
            verifyPageLive(
              sql,
              decodeImportPayload({
                pageId,
                entries: [
                  {
                    unit: { kind: 'new', name: 'Unit 4' },
                    type: 'word',
                    targetText: 'mémoire',
                    nativeText: 'Erinnerung',
                  },
                ],
              }),
              courseId,
            ),
          );
          expect(result._tag).toBe('Left');
          const residue = yield* sql<{
            readonly entries: number;
            readonly newUnits: number;
            readonly verifiedPages: number;
          }>`
            select
              (select count(*)::integer from entries) as entries,
              (select count(*)::integer from units where course_id = ${courseId}) as "newUnits",
              (select count(*)::integer from pages where status = 'verified') as "verifiedPages"
          `;
          expect(residue[0]).toEqual({
            entries: 0,
            newUnits: 0,
            verifiedPages: 0,
          });
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });
});
