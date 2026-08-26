import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { Database } from '../client';
import {
  testDatabaseLayer,
  withTestDatabase,
} from '../testing/postgres-test-database';
import {
  migrateToNullableUnits,
  migrateToPreUnitSchema,
  migrateToRequiredUnits,
} from './unit-migration-test-support';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const provideDatabase = <A, E, R>(
  url: string,
  effect: Effect.Effect<A, E, R | Database>,
) => effect.pipe(Effect.provide(testDatabaseLayer(url)));

const migrateToPhaseOne = (url: string) =>
  Effect.zipRight(migrateToPreUnitSchema(url), migrateToNullableUnits(url));

describe('required unit migration', () => {
  it('upgrades filed vocabulary and rejects future entries without a unit', async () => {
    await Effect.runPromise(
      withTestDatabase((database) =>
        Effect.gen(function* () {
          yield* migrateToPhaseOne(database.url);
          yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              yield* sql`
                insert into courses (id, name, target_language)
                values (${courseId}, 'French', 'fr')
              `;
              const createdUnits = yield* sql<{ readonly id: string }>`
                insert into units (course_id, name, position)
                values (${courseId}, 'Unit 1', 0)
                returning id
              `;
              yield* sql`
                insert into entries (
                  course_id, unit_id, type, target_text, native_text
                ) values (
                  ${courseId}, ${createdUnits[0]?.id ?? null},
                  'word', 'livre', 'Buch'
                )
              `;
            }),
          );

          yield* migrateToRequiredUnits(database.url);

          yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              const columns = yield* sql<{ readonly nullable: string }>`
                select is_nullable as nullable
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'entries'
                  and column_name = 'unit_id'
              `;
              expect(columns).toEqual([{ nullable: 'NO' }]);

              const unfiledInsert = yield* Effect.either(sql`
                insert into entries (
                  course_id, type, target_text, native_text
                ) values (${courseId}, 'word', 'mémoire', 'Erinnerung')
              `);
              expect(unfiledInsert._tag).toBe('Left');
              const entries = yield* sql<{ readonly count: number }>`
                select count(*)::integer as count from entries
              `;
              expect(entries).toEqual([{ count: 1 }]);
            }),
          );
        }),
      ),
    );
  });

  it('refuses to apply while legacy vocabulary remains unfiled', async () => {
    await Effect.runPromise(
      withTestDatabase((database) =>
        Effect.gen(function* () {
          yield* migrateToPhaseOne(database.url);
          yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              yield* sql`
                insert into courses (id, name, target_language)
                values (${courseId}, 'French', 'fr')
              `;
              yield* sql`
                insert into entries (
                  course_id, type, target_text, native_text
                ) values (${courseId}, 'word', 'livre', 'Buch')
              `;
            }),
          );

          const migration = yield* Effect.either(
            migrateToRequiredUnits(database.url),
          );
          expect(migration._tag).toBe('Left');

          yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              const columns = yield* sql<{ readonly nullable: string }>`
                select is_nullable as nullable
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'entries'
                  and column_name = 'unit_id'
              `;
              const unfiled = yield* sql<{ readonly count: number }>`
                select count(*)::integer as count
                from entries
                where unit_id is null
              `;
              expect(columns).toEqual([{ nullable: 'YES' }]);
              expect(unfiled).toEqual([{ count: 1 }]);
            }),
          );
        }),
      ),
    );
  });
});
