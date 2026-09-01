import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { sessionSectionSize } from '../../../shared/session/section-policy';
import { LearningService } from './learning-service';
import { LearningStore } from './learning-store';

const courseA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const courseB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const unitA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const unitB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const entryA = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const targetCard = '11111111-1111-4111-8111-111111111111';
const nativeCard = '22222222-2222-4222-8222-222222222222';
const remainingBatchCount = 5;
const largeBatchCount = sessionSectionSize + remainingBatchCount;

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

describe('Learning selection store live', () => {
  it('loads only selected vocabulary from the matching course', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        const serviceLayer = LearningService.Default.pipe(
          Layer.provide(LearningStore.live.pipe(Layer.provide(databaseLayer))),
        );
        return Effect.gen(function* () {
          yield* seed.pipe(Effect.provide(databaseLayer));
          const service = yield* LearningService;
          const selection = yield* service.getSelection(courseA, {
            entryIds: [entryA],
          });
          expect(selection.directions).toEqual([
            { direction: 'to_target', unintroduced: 1 },
          ]);
          expect(selection.items).toEqual([
            expect.objectContaining({
              cardId: targetCard,
              unitId: unitA,
            }),
          ]);
          const wrongCourse = yield* service.getSelection(courseB, {
            entryIds: [entryA],
          });
          expect(wrongCourse.items).toEqual([]);
        }).pipe(Effect.provide(serviceLayer));
      }),
    );
  });
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
          expect(pass.directions).toEqual([
            { direction: 'to_target', unintroduced: 1 },
          ]);
          expect(pass.items[0]).toMatchObject({
            cardId: targetCard,
            direction: 'to_target',
            unitId: unitA,
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
          expect(reversePass.directions).toEqual([
            { direction: 'to_native', unintroduced: 1 },
          ]);
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

  it('loads at most one section per direction and retains the remaining count', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        const serviceLayer = LearningService.Default.pipe(
          Layer.provide(LearningStore.live.pipe(Layer.provide(databaseLayer))),
        );
        return Effect.gen(function* () {
          yield* seed.pipe(Effect.provide(databaseLayer));
          yield* Effect.gen(function* () {
            const sql = yield* Database;
            yield* sql`
              insert into entries (
                id, course_id, unit_id, target_text, native_text
              )
              select (
                  '30000000-0000-4000-8000-' || lpad(n::text, 12, '0')
                )::uuid,
                ${courseB}, ${unitB}, 'target ' || n, 'native ' || n
              from generate_series(1, ${largeBatchCount}) as n
            `;
            yield* sql`
              insert into cards (entry_id, direction)
              select e.id, d.direction
              from entries e
              cross join unnest(
                array['to_target', 'to_native']::answer_direction[]
              ) as d(direction)
              where e.unit_id = ${unitB}
            `;
          }).pipe(Effect.provide(databaseLayer));

          const service = yield* LearningService;
          const first = yield* service.getPass(courseB, unitB);
          expect(first.directions).toEqual([
            { direction: 'to_target', unintroduced: largeBatchCount },
            { direction: 'to_native', unintroduced: largeBatchCount },
          ]);
          const targetItems = first.items.filter(
            (item) => item.direction === 'to_target',
          );
          expect(targetItems).toHaveLength(sessionSectionSize);

          yield* Effect.forEach(
            targetItems,
            (item) => service.introduce(courseB, unitB, item.cardId),
            { concurrency: 'unbounded' },
          );
          const second = yield* service.getPass(courseB, unitB);
          expect(
            second.items.filter((item) => item.direction === 'to_target'),
          ).toHaveLength(remainingBatchCount);
          expect(second.directions).toContainEqual({
            direction: 'to_target',
            unintroduced: remainingBatchCount,
          });
        }).pipe(Effect.provide(serviceLayer));
      }),
    );
  });
});
