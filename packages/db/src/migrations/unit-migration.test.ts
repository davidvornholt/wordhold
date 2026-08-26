import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { Database } from '../client';
import { migrateDatabase } from '../migrate';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
  withTestDatabase,
} from '../testing/postgres-test-database';
import { MigrationError } from './migration-error';

const courseA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const courseB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const pageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const migrationBeforeUnits = 3;
const migrationWithNullableUnits = 4;

const provideDatabase = <A, E, R>(
  url: string,
  effect: Effect.Effect<A, E, R | Database>,
) => effect.pipe(Effect.provide(testDatabaseLayer(url)));

describe('unit migrations', () => {
  it('preserves page provenance and files orphaned vocabulary', async () => {
    await Effect.runPromise(
      withTestDatabase((database) =>
        Effect.gen(function* () {
          yield* migrateDatabase(database.url, migrationBeforeUnits);
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
          yield* migrateDatabase(database.url);
          const rows = yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              return yield* sql<{
                readonly isHolding: boolean;
                readonly pageId: string | null;
                readonly unitId: string;
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
          expect(rows[0]).toMatchObject({
            isHolding: false,
            pageId,
          });
          expect(rows[1]).toMatchObject({
            isHolding: true,
            pageId: null,
          });
          expect(rows[0]?.unitId).not.toBe(rows[1]?.unitId);
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
            const units = yield* sql<{ readonly id: string }>`
              insert into units (course_id, name, position)
              values (${courseA}, 'Unit 1', 0)
              returning id
            `;
            const unitId = units[0]?.id ?? '';
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

  it('stops the backfill before tightening a cross-course legacy row', async () => {
    await Effect.runPromise(
      withTestDatabase((database) =>
        Effect.gen(function* () {
          yield* migrateDatabase(database.url, migrationWithNullableUnits);
          yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              yield* sql`
                insert into courses (id, name, target_language)
                values
                  (${courseA}, 'French', 'fr'),
                  (${courseB}, 'English', 'en')
              `;
              const units = yield* sql<{ readonly id: string }>`
                insert into units (course_id, name, position)
                values (${courseA}, 'Unit 1', 0)
                returning id
              `;
              yield* sql`
                insert into entries (
                  course_id, unit_id, type, target_text, native_text
                ) values (
                  ${courseB}, ${units[0]?.id ?? null}, 'word', 'book', 'Buch'
                )
              `;
            }),
          );
          const result = yield* Effect.either(migrateDatabase(database.url));
          expect(result).toEqual(
            expect.objectContaining({
              _tag: 'Left',
              left: expect.any(MigrationError),
            }),
          );
        }),
      ),
    );
  });
});
