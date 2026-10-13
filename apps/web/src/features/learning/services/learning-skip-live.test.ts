import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { seedOwner } from '../../../shared/testing/owner-fixture';
import { LearningService } from './learning-service';
import { LearningStore } from './learning-store';

const owner = 'skip-learning-owner';
const course = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherCourse = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const book = 'abababab-abab-4bab-8bab-abababababab';
const unit = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const entry = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const targetCard = '11111111-1111-4111-8111-111111111111';
const nativeCard = '22222222-2222-4222-8222-222222222222';
const synonymCard = '33333333-3333-4333-8333-333333333333';

// The course practises only `to_target` among the translations, so the
// entry's `to_native` card is out of its plan. It practises synonyms, so the
// synonym card is asked once the word is learned.
const seed = Effect.gen(function* () {
  const sql = yield* Database;
  yield* seedOwner(owner);
  yield* sql`
    insert into courses (id, owner_id, name, target_language, directions)
    values
      (${course}, ${owner}, 'French', 'fr', '{to_target}'),
      (${otherCourse}, ${owner}, 'English', 'en', '{to_target,to_native}')
  `;
  yield* sql`
    insert into books (id, course_id, name, position)
    values (${book}, ${course}, 'Book', 0)
  `;
  yield* sql`
    insert into units (id, course_id, book_id, name, position)
    values (${unit}, ${course}, ${book}, 'Unit', 0)
  `;
  yield* sql`
    insert into entries
      (id, course_id, book_id, unit_id, target_text, native_text, synonyms)
    values
      (${entry}, ${course}, ${book}, ${unit}, 'regarder', 'ansehen',
        '{observer}')
  `;
  yield* sql`
    insert into cards (id, entry_id, direction)
    values (${targetCard}, ${entry}, 'to_target'),
      (${nativeCard}, ${entry}, 'to_native'),
      (${synonymCard}, ${entry}, 'to_synonym')
  `;
});

const introducedAt = Effect.gen(function* () {
  const sql = yield* Database;
  const rows = yield* sql<{
    readonly id: string;
    readonly introducedAt: Date | null;
  }>`
    select id, introduced_at as "introducedAt" from cards order by id
  `;
  return Object.fromEntries(rows.map((row) => [row.id, row.introducedAt]));
});

const withService = <A, E>(
  test: Effect.Effect<A, E, LearningService | Database>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      const serviceLayer = LearningService.layer.pipe(
        Layer.provide(LearningStore.live.pipe(Layer.provide(databaseLayer))),
      );
      return seed.pipe(
        Effect.andThen(test),
        Effect.provide(Layer.merge(serviceLayer, databaseLayer)),
      );
    }),
  );

describe('Skipping the learning pass live', () => {
  it('skips only cards of the course and the directions it learns, and asks the synonyms with them', async () => {
    await withService(
      Effect.gen(function* () {
        const service = yield* LearningService;
        const allCards = [targetCard, nativeCard, synonymCard];
        expect(yield* service.skipLearning(otherCourse, allCards)).toEqual([]);
        expect(yield* service.skipLearning(course, [synonymCard])).toEqual([]);
        expect((yield* introducedAt)[synonymCard]).toBeNull();

        expect(yield* service.skipLearning(course, allCards)).toEqual([
          targetCard,
        ]);
        expect(yield* service.skipLearning(course, [targetCard])).toEqual([]);

        const cards = yield* introducedAt;
        expect(cards[targetCard]).toBeInstanceOf(Date);
        expect(cards[synonymCard]).toEqual(cards[targetCard] ?? null);
        expect(cards[nativeCard]).toBeNull();
        const pass = yield* service.getPass(course, { unitId: unit });
        expect(pass.items).toEqual([]);
      }),
    );
  });

  it('returns a skipped card to the learning pass until it has been practised, with its unanswered synonyms', async () => {
    await withService(
      Effect.gen(function* () {
        const service = yield* LearningService;
        const sql = yield* Database;
        yield* service.skipLearning(course, [targetCard]);
        expect(
          yield* service.returnToLearning(otherCourse, [targetCard]),
        ).toEqual([]);
        expect(yield* service.returnToLearning(course, [synonymCard])).toEqual(
          [],
        );
        expect(yield* service.returnToLearning(course, [targetCard])).toEqual([
          targetCard,
        ]);
        expect((yield* introducedAt)[synonymCard]).toBeNull();
        // Synonyms have no learning pass of their own.
        const pass = yield* service.getPass(course, { unitId: unit });
        expect(pass.items.map((item) => item.cardId)).toEqual([targetCard]);

        // An answered synonym card keeps its schedule.
        yield* service.skipLearning(course, [targetCard]);
        yield* sql`update cards set state = 'review' where id = ${synonymCard}`;
        expect(yield* service.returnToLearning(course, [targetCard])).toEqual([
          targetCard,
        ]);
        expect((yield* introducedAt)[synonymCard]).toBeInstanceOf(Date);

        yield* service.skipLearning(course, [targetCard]);
        yield* sql`update cards set state = 'review' where id = ${targetCard}`;
        expect(yield* service.returnToLearning(course, [targetCard])).toEqual(
          [],
        );
        expect((yield* introducedAt)[targetCard]).toBeInstanceOf(Date);
      }),
    );
  });

  it('keeps the synonyms asked while another translation stays learned', async () => {
    await withService(
      Effect.gen(function* () {
        const service = yield* LearningService;
        const sql = yield* Database;
        yield* sql`
          update courses set directions = '{to_target,to_native}'
          where id = ${course}
        `;
        yield* service.skipLearning(course, [targetCard, nativeCard]);
        const skipped = yield* introducedAt;
        expect(yield* service.returnToLearning(course, [targetCard])).toEqual([
          targetCard,
        ]);
        expect((yield* introducedAt)[synonymCard]).toEqual(
          skipped[synonymCard] ?? null,
        );
        expect(yield* service.returnToLearning(course, [nativeCard])).toEqual([
          nativeCard,
        ]);
        expect((yield* introducedAt)[synonymCard]).toBeNull();
      }),
    );
  });
});
