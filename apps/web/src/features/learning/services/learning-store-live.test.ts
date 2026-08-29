import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { LearningService } from './learning-service';
import { LearningStore } from './learning-store';

const courseA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const courseB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const unitA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const unitB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const entryA = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const targetCard = '11111111-1111-4111-8111-111111111111';
const nativeCard = '22222222-2222-4222-8222-222222222222';

const seed = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, name, target_language, directions)
    values
      (${courseA}, 'French', 'fr', '{to_target}'),
      (${courseB}, 'English', 'en', '{to_target,to_native}')
  `;
  yield* sql`
    insert into units (id, course_id, name, position)
    values
      (${unitA}, ${courseA}, 'Unit A', 0),
      (${unitB}, ${courseB}, 'Unit B', 0)
  `;
  yield* sql`
    insert into entries (
      id, course_id, unit_id, target_text, native_text
    ) values (
      ${entryA}, ${courseA}, ${unitA}, 'to look (at)', 'ansehen'
    )
  `;
  yield* sql`
    insert into accepted_answers (
      entry_id, direction, text, normalized, source
    ) values
      (${entryA}, 'to_target', 'to look (at)', 'to look (at)', 'textbook'),
      (${entryA}, 'to_native', 'ansehen', 'ansehen', 'textbook'),
      (${entryA}, 'to_target', 'to watch', 'to watch', 'judge')
  `;
  yield* sql`
    insert into cards (id, entry_id, direction)
    values
      (${targetCard}, ${entryA}, 'to_target'),
      (${nativeCard}, ${entryA}, 'to_native')
  `;
});

describe('LearningStore live', () => {
  it('introduces only enabled card directions and offers a direction enabled later', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        const serviceLayer = LearningService.Default.pipe(
          Layer.provide(LearningStore.live.pipe(Layer.provide(databaseLayer))),
        );
        return Effect.gen(function* () {
          yield* seed.pipe(Effect.provide(databaseLayer));
          const service = yield* LearningService;
          const pass = yield* service.getPass(courseA, unitA);
          expect(pass.items).toHaveLength(1);
          expect(pass.items[0]).toMatchObject({
            cardId: targetCard,
            direction: 'to_target',
            textbookAnswers: ['to look (at)'],
          });

          const wrongCourse = yield* Effect.either(
            service.getPass(courseB, unitA),
          );
          const wrongUnit = yield* Effect.either(
            service.introduce(courseA, unitB, targetCard),
          );
          expect(wrongCourse._tag === 'Left' && wrongCourse.left._tag).toBe(
            'LearningUnitNotFoundError',
          );
          expect(wrongUnit._tag === 'Left' && wrongUnit.left._tag).toBe(
            'LearningCardNotFoundError',
          );

          yield* service.introduce(courseA, unitA, targetCard);
          yield* service.introduce(courseA, unitA, targetCard);
          const cards = yield* Effect.gen(function* () {
            const sql = yield* Database;
            return yield* sql<{
              readonly direction: string;
              readonly introducedAt: Date | null;
            }>`
              select direction, introduced_at as "introducedAt"
              from cards where entry_id = ${entryA}
              order by direction
            `;
          }).pipe(Effect.provide(databaseLayer));
          expect(cards).toHaveLength(2);
          expect(cards).toContainEqual({
            direction: 'to_target',
            introducedAt: expect.any(Date),
          });
          expect(cards).toContainEqual({
            direction: 'to_native',
            introducedAt: null,
          });

          yield* Effect.gen(function* () {
            const sql = yield* Database;
            yield* sql`
              update courses set directions = '{to_target,to_native}'
              where id = ${courseA}
            `;
          }).pipe(Effect.provide(databaseLayer));
          const reversePass = yield* service.getPass(courseA, unitA);
          expect(reversePass.items).toEqual([
            expect.objectContaining({
              cardId: nativeCard,
              direction: 'to_native',
              textbookAnswers: ['ansehen'],
            }),
          ]);
        }).pipe(Effect.provide(serviceLayer));
      }),
    );
  });
});
