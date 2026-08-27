import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { Database } from '../client';
import {
  testDatabaseLayer,
  withTestDatabase,
} from '../testing/postgres-test-database';
import { backfillIntroductions } from './backfill-introductions';
import {
  migrateToLearningSchema,
  migrateToNullableUnits,
  migrateToPreUnitSchema,
  migrateToRequiredUnits,
} from './unit-migration-test-support';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const unitId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const reviewedAt = new Date('2026-08-01T10:00:00.000Z');

const provideDatabase = <A, E, R>(
  url: string,
  effect: Effect.Effect<A, E, R | Database>,
) => effect.pipe(Effect.provide(testDatabaseLayer(url)));

const migrateBeforeLearning = (url: string) =>
  migrateToPreUnitSchema(url).pipe(
    Effect.zipRight(migrateToNullableUnits(url)),
    Effect.zipRight(migrateToRequiredUnits(url)),
  );

describe('introduction migration boundary', () => {
  it('preserves reviewed cards and leaves untouched cards to learn', async () => {
    await Effect.runPromise(
      withTestDatabase((database) =>
        Effect.gen(function* () {
          yield* migrateBeforeLearning(database.url);
          yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              yield* sql`
                insert into courses (id, name, target_language)
                values (${courseId}, 'French', 'fr')
              `;
              yield* sql`
                insert into units (id, course_id, name, position)
                values (${unitId}, ${courseId}, 'Unit 1', 0)
              `;
              const entries = yield* sql<{ readonly id: string }>`
                insert into entries (
                  course_id, unit_id, type, target_text, native_text
                ) values
                  (${courseId}, ${unitId}, 'word', 'mémoire', 'Erinnerung'),
                  (${courseId}, ${unitId}, 'word', 'livre', 'Buch')
                returning id
              `;
              yield* sql`
                insert into cards (entry_id, direction, last_reviewed_at)
                values
                  (${entries[0]?.id}, 'to_target', ${reviewedAt}),
                  (${entries[1]?.id}, 'to_target', null)
              `;
            }),
          );

          yield* migrateToLearningSchema(database.url);
          yield* backfillIntroductions(database.url);
          const first = yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              return yield* sql<{
                readonly introducedAt: Date | null;
                readonly lastReviewedAt: Date | null;
              }>`
                select introduced_at as "introducedAt",
                  last_reviewed_at as "lastReviewedAt"
                from cards order by last_reviewed_at nulls last
              `;
            }),
          );
          yield* backfillIntroductions(database.url);
          const retry = yield* provideDatabase(
            database.url,
            Effect.gen(function* () {
              const sql = yield* Database;
              return yield* sql<{
                readonly introducedAt: Date | null;
              }>`
                select introduced_at as "introducedAt"
                from cards order by last_reviewed_at nulls last
              `;
            }),
          );

          expect(first).toEqual([
            { introducedAt: reviewedAt, lastReviewedAt: reviewedAt },
            { introducedAt: null, lastReviewedAt: null },
          ]);
          expect(retry).toEqual(
            first.map(({ introducedAt }) => ({ introducedAt })),
          );
        }),
      ),
    );
  });
});
