import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { Database } from '../client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
  withTestDatabase,
} from '../testing/postgres-test-database';
import { backfillUnits } from './backfill-units';
import {
  migrateToNullableUnits,
  migrateToPreUnitSchema,
} from './unit-migration-test-support';

const courseA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const courseB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const pageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const provideDatabase = <A, E, R>(
  url: string,
  effect: Effect.Effect<A, E, R | Database>,
) => effect.pipe(Effect.provide(testDatabaseLayer(url)));

describe('unit migration boundary', () => {
  it('upgrades populated legacy data and retries without changing the result', async () => {
    await Effect.runPromise(
      withTestDatabase((database) =>
        Effect.gen(function* () {
          yield* migrateToPreUnitSchema(database.url);
          yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              const unitColumns = yield* sql<{ readonly count: number }>`
                select count(*)::integer as count
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'entries'
                  and column_name = 'unit_id'
              `;
              expect(unitColumns[0]?.count).toBe(0);
              yield* sql`
                insert into courses (id, name, target_language)
                values (${courseA}, 'French', 'fr')
              `;
              yield* sql`
                insert into pages (id, course_id, label, image_path)
                values (${pageId}, ${courseA}, 'Page 12', 'page.png')
              `;
              yield* sql`
                insert into entries (
                  course_id, page_id, type, target_text, native_text
                ) values
                  (${courseA}, ${pageId}, 'word', 'mémoire', 'Erinnerung'),
                  (${courseA}, null, 'word', 'livre', 'Buch')
              `;
            }),
          );

          yield* migrateToNullableUnits(database.url);
          yield* backfillUnits(database.url);

          const firstRows = yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              return yield* sql<{
                readonly isHolding: boolean;
                readonly pageId: string | null;
                readonly unitId: string | null;
              }>`
                select units.is_holding as "isHolding",
                  entries.page_id as "pageId",
                  entries.unit_id as "unitId"
                from entries
                join units
                  on units.id = entries.unit_id
                  and units.course_id = entries.course_id
                order by entries.page_id nulls last
              `;
            }),
          );
          yield* backfillUnits(database.url);
          const retryState = yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              const rows = yield* sql<{
                readonly isHolding: boolean;
                readonly pageId: string | null;
                readonly unitId: string | null;
              }>`
                select units.is_holding as "isHolding",
                  entries.page_id as "pageId",
                  entries.unit_id as "unitId"
                from entries
                join units
                  on units.id = entries.unit_id
                  and units.course_id = entries.course_id
                order by entries.page_id nulls last
              `;
              const unitCount = yield* sql<{ readonly count: number }>`
                select count(*)::integer as count from units
              `;
              return { rows, unitCount: unitCount[0]?.count };
            }),
          );

          expect(firstRows).toHaveLength(2);
          expect(firstRows[0]).toMatchObject({ isHolding: false, pageId });
          expect(firstRows[1]).toMatchObject({
            isHolding: true,
            pageId: null,
          });
          expect(firstRows[0]?.unitId).not.toBe(firstRows[1]?.unitId);
          expect(firstRows.every((row) => row.unitId !== null)).toBe(true);
          expect(retryState.rows).toEqual(firstRows);
          expect(retryState.unitCount).toBe(2);
        }),
      ),
    );
  });

  it('rejects cross-course units and still lets a course cascade-delete', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        provideDatabase(
          database.url,
          Effect.gen(function* () {
            const sql = yield* Database;
            yield* sql`
              insert into courses (id, name, target_language)
              values
                (${courseA}, 'French', 'fr'),
                (${courseB}, 'English', 'en')
            `;
            const createdUnits = yield* sql<{ readonly id: string }>`
              insert into units (course_id, name, position)
              values (${courseA}, 'Unit 1', 0)
              returning id
            `;
            const unitId = createdUnits[0]?.id ?? '';
            const mismatch = yield* Effect.either(sql`
              insert into entries (
                course_id, unit_id, type, target_text, native_text
              ) values (${courseB}, ${unitId}, 'word', 'book', 'Buch')
            `);
            expect(mismatch._tag).toBe('Left');
            yield* sql`
              insert into entries (
                course_id, unit_id, type, target_text, native_text
              ) values (${courseA}, ${unitId}, 'word', 'livre', 'Buch')
            `;
            yield* sql`delete from courses where id = ${courseA}`;
            const remaining = yield* sql<{ readonly count: number }>`
              select count(*)::integer as count
              from units
              where course_id = ${courseA}
            `;
            expect(remaining[0]?.count).toBe(0);
          }),
        ),
      ),
    );
  });
});
