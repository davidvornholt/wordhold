import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  fixtureCourseId,
  fixtureUnitId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { CourseDatabaseError } from '../errors/courses-errors';
import { CourseStore } from './course-store';

const missingCourseId = '11111111-1111-4111-8111-111111111111';
const missingUnitId = '99999999-9999-4999-8999-999999999999';

const runStoreTest = <A, E>(
  effect: Effect.Effect<A, E, Database | CourseStore>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return effect.pipe(
        Effect.provide(CourseStore.live.pipe(Layer.provide(databaseLayer))),
        Effect.provide(databaseLayer),
      );
    }),
  );

describe('CourseStore PostgreSQL course contents', () => {
  it('lists empty and populated units in deterministic course order', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        const sql = yield* Database;
        const store = yield* CourseStore;
        yield* sql`
          insert into units (id, course_id, name, position)
          values
            ('ffffffff-ffff-4fff-8fff-ffffffffffff', ${fixtureCourseId}, 'Unit 3', 2),
            ('99999999-9999-4999-8999-999999999999', ${fixtureCourseId}, 'Unit 2', 1)
        `;

        expect(yield* store.listUnits(fixtureCourseId)).toEqual([
          {
            id: fixtureUnitId,
            name: 'Unit 1',
            words: 3,
            unlearned: 1,
          },
          {
            id: '99999999-9999-4999-8999-999999999999',
            name: 'Unit 2',
            words: 0,
            unlearned: 0,
          },
          {
            id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            name: 'Unit 3',
            words: 0,
            unlearned: 0,
          },
        ]);
        expect(yield* store.listUnits(missingCourseId)).toEqual([]);
      }),
    );
  });
});

describe('CourseStore PostgreSQL word contents', () => {
  it('lists words deterministically and requires every direction card', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        const sql = yield* Database;
        const store = yield* CourseStore;
        yield* sql`
          update cards
          set introduced_at = ${new Date('2026-08-20T12:00:00.000Z')}
          where entry_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
            and direction = 'to_target'
        `;

        expect(yield* store.listWords(fixtureUnitId)).toEqual([
          {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            targetText: 'livre',
            nativeText: 'Buch',
            learned: true,
          },
          {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            targetText: 'mémoire',
            nativeText: 'Erinnerung',
            learned: true,
          },
          {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            targetText: 'neuf',
            nativeText: 'neu',
            learned: false,
          },
        ]);
        expect(yield* store.listWords(missingUnitId)).toEqual([]);
        expect(yield* store.listUnits(fixtureCourseId)).toContainEqual({
          id: fixtureUnitId,
          name: 'Unit 1',
          words: 3,
          unlearned: 1,
        });

        yield* sql`
          delete from cards
          where entry_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
            and direction = 'to_native'
        `;
        expect(yield* store.listWords(fixtureUnitId)).toContainEqual({
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          targetText: 'neuf',
          nativeText: 'neu',
          learned: false,
        });
        expect(yield* store.listUnits(fixtureCourseId)).toContainEqual({
          id: fixtureUnitId,
          name: 'Unit 1',
          words: 3,
          unlearned: 1,
        });
      }),
    );
  });
});

describe('CourseStore PostgreSQL course content errors', () => {
  it('maps PostgreSQL unit and word failures to their operations', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        const sql = yield* Database;
        const store = yield* CourseStore;
        yield* sql`drop table entries cascade`;
        const units = yield* store
          .listUnits(fixtureCourseId)
          .pipe(Effect.either);
        const words = yield* store.listWords(fixtureUnitId).pipe(Effect.either);
        const unitsError = units._tag === 'Left' ? units.left : undefined;
        const wordsError = words._tag === 'Left' ? words.left : undefined;
        expect(units._tag).toBe('Left');
        expect(words._tag).toBe('Left');
        expect(unitsError).toBeInstanceOf(CourseDatabaseError);
        expect(wordsError).toBeInstanceOf(CourseDatabaseError);
        expect(unitsError?.operation).toBe('list units');
        expect(wordsError?.operation).toBe('list words');
      }),
    );
  });
});
