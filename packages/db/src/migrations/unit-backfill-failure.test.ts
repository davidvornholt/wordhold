import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { Database } from '../client';
import {
  testDatabaseLayer,
  withTestDatabase,
} from '../testing/postgres-test-database';
import { backfillUnits } from './backfill-units';
import { UnitBackfillError } from './unit-backfill-error';
import {
  migrateToNullableUnits,
  migrateToPreUnitSchema,
} from './unit-migration-test-support';

const courseA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const courseB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const provideDatabase = <A, E, R>(
  url: string,
  effect: Effect.Effect<A, E, R | Database>,
) => effect.pipe(Effect.provide(testDatabaseLayer(url)));

describe('unit backfill failures', () => {
  it('rolls back every unit and assignment when filing fails', async () => {
    await Effect.runPromise(
      withTestDatabase((database) =>
        Effect.gen(function* () {
          yield* migrateToPreUnitSchema(database.url);
          yield* migrateToNullableUnits(database.url);
          yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              yield* sql`
                insert into courses (id, name, target_language)
                values (${courseA}, 'French', 'fr')
              `;
              yield* sql`
                insert into pages (
                  course_id, label, image_path, captured_at
                )
                values
                  (
                    ${courseA}, 'Page 1', 'page-1.png',
                    '2026-01-01T00:00:00Z'
                  ),
                  (
                    ${courseA}, 'Page 2', 'page-2.png',
                    '2026-01-02T00:00:00Z'
                  )
              `;
              yield* sql`
                insert into entries (
                  course_id, page_id, type, target_text, native_text
                )
                select ${courseA}, id, 'word', label, label
                from pages
                where course_id = ${courseA}
              `;
              yield* sql`
                create function fail_second_unit_assignment()
                returns trigger
                language plpgsql
                as 'begin
                  if NEW.target_text = ''Page 2'' and NEW.unit_id is not null then
                    raise exception ''forced assignment failure'';
                  end if;
                  return NEW;
                end'
              `;
              yield* sql`
                create trigger fail_second_unit_assignment
                before update on entries
                for each row execute function fail_second_unit_assignment()
              `;
            }),
          );

          const result = yield* Effect.either(backfillUnits(database.url));
          expect(result._tag).toBe('Left');
          expect(result).toEqual(
            expect.objectContaining({ left: expect.any(UnitBackfillError) }),
          );
          expect(result).toEqual(
            expect.objectContaining({
              left: expect.objectContaining({
                operation: 'file legacy vocabulary',
                message: 'Unit backfill failed: file legacy vocabulary.',
              }),
            }),
          );

          const state = yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              return yield* sql<{
                readonly assignedEntries: number;
                readonly units: number;
              }>`
                select
                  (select count(*)::integer from units) as units,
                  (
                    select count(*)::integer
                    from entries
                    where unit_id is not null
                  ) as "assignedEntries"
              `;
            }),
          );
          expect(state).toEqual([{ assignedEntries: 0, units: 0 }]);
        }),
      ),
    );
  });

  it('reports the exact ownership mismatch operation and message', async () => {
    await Effect.runPromise(
      withTestDatabase((database) =>
        Effect.gen(function* () {
          yield* migrateToPreUnitSchema(database.url);
          yield* migrateToNullableUnits(database.url);
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
          expect(result._tag).toBe('Left');
          expect(result).toEqual(
            expect.objectContaining({ left: expect.any(UnitBackfillError) }),
          );
          expect(result).toEqual(
            expect.objectContaining({
              left: expect.objectContaining({
                operation: 'check course ownership',
                message:
                  'Unit backfill stopped because an entry references a unit from another course.',
              }),
            }),
          );
        }),
      ),
    );
  });
});
