import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  fixtureCourseId,
  fixtureNow,
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

        expect(yield* store.listUnits(fixtureCourseId, fixtureNow)).toEqual([
          {
            id: fixtureUnitId,
            name: 'Unit 1',
            entries: 3,
            unintroduced: 1,
            due: 1,
            firstReviews: 2,
            nextDueAt: new Date('2026-08-21T12:00:00.000Z'),
          },
          {
            id: '99999999-9999-4999-8999-999999999999',
            name: 'Unit 2',
            entries: 0,
            unintroduced: 0,
            due: 0,
            firstReviews: 0,
            nextDueAt: null,
          },
          {
            id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            name: 'Unit 3',
            entries: 0,
            unintroduced: 0,
            due: 0,
            firstReviews: 0,
            nextDueAt: null,
          },
        ]);
        expect(yield* store.listUnits(missingCourseId, fixtureNow)).toEqual([]);
      }),
    );
  });
});

describe('CourseStore PostgreSQL entry contents', () => {
  it('lists entries deterministically and requires every direction card', async () => {
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

        const listed = yield* store.listEntries(fixtureUnitId);
        expect(listed.map(({ cards: _cards, ...entry }) => entry)).toEqual([
          {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            targetText: 'livre',
            nativeText: 'Buch',
            introduced: true,
            unitId: fixtureUnitId,
            unitName: 'Unit 1',
          },
          {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            targetText: 'mémoire',
            nativeText: 'Erinnerung',
            introduced: true,
            unitId: fixtureUnitId,
            unitName: 'Unit 1',
          },
          {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            targetText: 'neuf',
            nativeText: 'neu',
            introduced: false,
            unitId: fixtureUnitId,
            unitName: 'Unit 1',
          },
        ]);
        expect(yield* store.listEntries(missingUnitId)).toEqual([]);
        expect(
          yield* store.listUnits(fixtureCourseId, fixtureNow),
        ).toContainEqual({
          id: fixtureUnitId,
          name: 'Unit 1',
          entries: 3,
          unintroduced: 1,
          due: 1,
          firstReviews: 3,
          nextDueAt: new Date('2026-08-21T12:00:00.000Z'),
        });

        yield* sql`
          delete from cards
          where entry_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
            and direction = 'to_native'
        `;
        expect(yield* store.listEntries(fixtureUnitId)).toContainEqual({
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          targetText: 'neuf',
          nativeText: 'neu',
          introduced: false,
          unitId: fixtureUnitId,
          unitName: 'Unit 1',
          cards: expect.any(Array),
        });
        expect(
          yield* store.listUnits(fixtureCourseId, fixtureNow),
        ).toContainEqual({
          id: fixtureUnitId,
          name: 'Unit 1',
          entries: 3,
          unintroduced: 1,
          due: 1,
          firstReviews: 3,
          nextDueAt: new Date('2026-08-21T12:00:00.000Z'),
        });
      }),
    );
  });
});

describe('CourseStore PostgreSQL course content errors', () => {
  it('maps PostgreSQL unit and entry failures to their operations', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        const sql = yield* Database;
        const store = yield* CourseStore;
        yield* sql`drop table entries cascade`;
        const units = yield* store
          .listUnits(fixtureCourseId, fixtureNow)
          .pipe(Effect.either);
        const entries = yield* store
          .listEntries(fixtureUnitId)
          .pipe(Effect.either);
        const unitsError = units._tag === 'Left' ? units.left : undefined;
        const entriesError = entries._tag === 'Left' ? entries.left : undefined;
        expect(units._tag).toBe('Left');
        expect(entries._tag).toBe('Left');
        expect(unitsError).toBeInstanceOf(CourseDatabaseError);
        expect(entriesError).toBeInstanceOf(CourseDatabaseError);
        expect(unitsError?.operation).toBe('list units');
        expect(entriesError?.operation).toBe('list vocabulary');
      }),
    );
  });
});
