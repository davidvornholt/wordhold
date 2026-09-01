import { describe, expect, it } from 'bun:test';
import type { Database } from '@wordhold/db/client';
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
import { CourseStore } from './course-store';

const missingCourseId = '11111111-1111-4111-8111-111111111111';

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

describe('CourseStore PostgreSQL unit mutations', () => {
  it('appends units and persists a complete reordered unit set', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        const store = yield* CourseStore;

        expect(yield* store.createUnit(fixtureCourseId, 'Unit 2')).toBe(
          'created',
        );
        expect(yield* store.createUnit(fixtureCourseId, 'Unit 2')).toBe(
          'duplicate',
        );
        expect(yield* store.createUnit(missingCourseId, 'Unit 1')).toBe(
          'course-missing',
        );

        const created = yield* store.listUnits(fixtureCourseId, fixtureNow);
        expect(created.map((unit) => unit.name)).toEqual(['Unit 1', 'Unit 2']);
        const reversedIds = [...created].reverse().map((unit) => unit.id);
        expect(yield* store.reorderUnits(fixtureCourseId, reversedIds)).toBe(
          true,
        );
        expect(
          (yield* store.listUnits(fixtureCourseId, fixtureNow)).map(
            (unit) => unit.name,
          ),
        ).toEqual(['Unit 2', 'Unit 1']);

        expect(
          yield* store.reorderUnits(fixtureCourseId, [fixtureUnitId]),
        ).toBe(false);
        expect(
          (yield* store.listUnits(fixtureCourseId, fixtureNow)).map(
            (unit) => unit.name,
          ),
        ).toEqual(['Unit 2', 'Unit 1']);
      }),
    );
  });
});
