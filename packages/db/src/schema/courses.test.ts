import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { Database } from '../client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '../testing/postgres-test-database';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('course direction constraint', () => {
  it('keeps at least one direction in PostgreSQL', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          const sql = yield* Database;
          yield* sql`
            insert into courses (id, name, target_language)
            values (${courseId}, 'French', 'fr')
          `;

          const update = yield* Effect.result(sql`
            update courses
            set directions = '{}'::answer_direction[]
            where id = ${courseId}
          `);
          expect(update._tag).toBe('Failure');
          const rows = yield* sql<{ readonly directions: string }>`
            select directions::text as directions
            from courses where id = ${courseId}
          `;
          expect(rows).toEqual([{ directions: '{to_target,to_native}' }]);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });

  it('keeps synonyms and antonyms out of the translation directions', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          const sql = yield* Database;
          yield* sql`
            insert into courses (id, name, target_language)
            values (${courseId}, 'English', 'en')
          `;

          const update = yield* Effect.result(sql`
            update courses
            set directions = '{to_target,to_synonym}'::answer_direction[]
            where id = ${courseId}
          `);
          expect(update._tag).toBe('Failure');
          const rows = yield* sql<{
            readonly directions: string;
            readonly practisesRelatedWords: boolean;
          }>`
            select directions::text as directions,
              practises_related_words as "practisesRelatedWords"
            from courses where id = ${courseId}
          `;
          expect(rows).toEqual([
            {
              directions: '{to_target,to_native}',
              practisesRelatedWords: true,
            },
          ]);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });
});

describe('list course constraint', () => {
  it('keeps a terms course monolingual and definition-only', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          const sql = yield* Database;
          const bilingual = yield* Effect.result(sql`
            insert into courses (id, name, kind, target_language, directions)
            values (${courseId}, 'Chemie', 'terms', 'fr', '{to_native}')
          `);
          expect(bilingual._tag).toBe('Failure');
          const bothDirections = yield* Effect.result(sql`
            insert into courses (id, name, kind, target_language)
            values (${courseId}, 'Chemie', 'terms', 'de')
          `);
          expect(bothDirections._tag).toBe('Failure');

          yield* sql`
            insert into courses (id, name, kind, target_language, directions)
            values (${courseId}, 'Chemie', 'terms', 'de', '{to_native}')
          `;
          const widen = yield* Effect.result(sql`
            update courses
            set directions = '{to_target,to_native}'::answer_direction[]
            where id = ${courseId}
          `);
          expect(widen._tag).toBe('Failure');
          const rows = yield* sql<{ readonly kind: string }>`
            select kind from courses where id = ${courseId}
          `;
          expect(rows).toEqual([{ kind: 'terms' }]);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });

  it('gives a texts course the same shape as a terms course', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) =>
        Effect.gen(function* () {
          const sql = yield* Database;
          const bothDirections = yield* Effect.result(sql`
            insert into courses (id, name, kind, target_language)
            values (${courseId}, 'Bibelverse', 'texts', 'de')
          `);
          expect(bothDirections._tag).toBe('Failure');

          yield* sql`
            insert into courses (id, name, kind, target_language, directions)
            values (${courseId}, 'Bibelverse', 'texts', 'de', '{to_native}')
          `;
          const rows = yield* sql<{ readonly kind: string }>`
            select kind from courses where id = ${courseId}
          `;
          expect(rows).toEqual([{ kind: 'texts' }]);
        }).pipe(Effect.provide(testDatabaseLayer(database.url))),
      ),
    );
  });
});
