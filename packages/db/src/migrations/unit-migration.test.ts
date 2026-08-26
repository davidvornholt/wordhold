import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { Database } from '../client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '../testing/postgres-test-database';
import { backfillUnits } from './backfill-units';
import { UnitBackfillError } from './unit-backfill-error';

const courseA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const courseB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const pageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const provideDatabase = <A, E, R>(
  url: string,
  effect: Effect.Effect<A, E, R | Database>,
) => effect.pipe(Effect.provide(testDatabaseLayer(url)));

describe('unit migration boundary', () => {
  it('preserves page provenance and files every legacy row', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
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

          yield* backfillUnits(database.url);

          const rows = yield* provideDatabase(
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
          expect(rows).toHaveLength(2);
          expect(rows[0]).toMatchObject({ isHolding: false, pageId });
          expect(rows[1]).toMatchObject({ isHolding: true, pageId: null });
          expect(rows[0]?.unitId).not.toBe(rows[1]?.unitId);
          expect(rows.every((row) => row.unitId !== null)).toBe(true);
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

  it('fails safely when legacy data crosses course ownership', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              yield* sql`
                alter table entries
                drop constraint entries_unit_course_units_id_course_fk
              `;
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
              yield* sql`
                insert into entries (
                  course_id, unit_id, type, target_text, native_text
                ) values (
                  ${courseB}, ${createdUnits[0]?.id ?? null}, 'word', 'book', 'Buch'
                )
              `;
            }),
          );

          const result = yield* Effect.either(backfillUnits(database.url));
          expect(result).toEqual(
            expect.objectContaining({
              _tag: 'Left',
              left: expect.any(UnitBackfillError),
            }),
          );
        }),
      ),
    );
  });
});
