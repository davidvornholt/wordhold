import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { decodeImportPayload } from '../schemas/import-payload';
import { verifyPageLive } from './verify-page-live';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const firstPageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const secondPageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const unitThreeEntryCount = 3;

const entry = (name: string, targetText: string) => ({
  unit: { kind: 'new' as const, name },
  type: 'word' as const,
  targetText,
  nativeText: `Deutsch ${targetText}`,
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
      (${firstPageId}, ${courseId}, 'first.png'),
      (${secondPageId}, ${courseId}, 'second.png')
  `;
});

describe('verifyPageLive persistence', () => {
  it('routes one page into two units and reuses a matching name', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* seedCourse;
          const sql = yield* Database;
          yield* verifyPageLive(
            sql,
            decodeImportPayload({
              pageId: firstPageId,
              entries: [
                entry('Unit 3', 'mémoire'),
                entry('Unit 4', 'livre'),
                entry('Unit 3', 'souvenir'),
              ],
            }),
            courseId,
          );
          yield* verifyPageLive(
            sql,
            decodeImportPayload({
              pageId: secondPageId,
              entries: [entry('Unit 3', 'répéter')],
            }),
            courseId,
          );
          const units = yield* sql<{
            readonly id: string;
            readonly name: string;
          }>`select id, name from units order by position`;
          expect(units.map((unit) => unit.name)).toEqual(['Unit 3', 'Unit 4']);
          const persisted = yield* sql<{
            readonly pageId: string;
            readonly unitId: string;
          }>`
            select page_id as "pageId", unit_id as "unitId"
            from entries
            order by target_text
          `;
          expect(
            new Set(
              persisted
                .filter((row) => row.pageId === firstPageId)
                .map((row) => row.unitId),
            ).size,
          ).toBe(2);
          expect(persisted.every((row) => row.pageId !== null)).toBe(true);
          const unitThree = units.find((unit) => unit.name === 'Unit 3');
          expect(
            persisted.filter((row) => row.unitId === unitThree?.id),
          ).toHaveLength(unitThreeEntryCount);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });

  it('allocates sequential positions across concurrent imports', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* seedCourse;
          const sql = yield* Database;
          yield* Effect.all(
            [
              verifyPageLive(
                sql,
                decodeImportPayload({
                  pageId: firstPageId,
                  entries: [entry('Unit 3', 'mémoire')],
                }),
                courseId,
              ),
              verifyPageLive(
                sql,
                decodeImportPayload({
                  pageId: secondPageId,
                  entries: [entry('Unit 4', 'livre')],
                }),
                courseId,
              ),
            ],
            { concurrency: 'unbounded' },
          );
          const positions = yield* sql<{ readonly position: number }>`
            select position from units order by position
          `;
          expect(positions.map((unit) => unit.position)).toEqual([0, 1]);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });
});
