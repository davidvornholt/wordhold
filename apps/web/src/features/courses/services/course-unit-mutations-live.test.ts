import { describe, expect, it } from 'bun:test';
import type { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  fixtureBookId,
  fixtureCourseId,
  fixtureNow,
  fixtureUnitId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { CourseStore } from './course-store';

const missingBookId = '11111111-1111-4111-8111-111111111111';

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

        expect(
          yield* store.createUnit(fixtureCourseId, fixtureBookId, 'Unit 2'),
        ).toBe('created');
        expect(
          yield* store.createUnit(fixtureCourseId, fixtureBookId, 'Unit 2'),
        ).toBe('duplicate');
        expect(
          yield* store.createUnit(fixtureCourseId, missingBookId, 'Unit 1'),
        ).toBe('book-missing');

        const created = yield* store.listUnits(fixtureCourseId, fixtureNow);
        expect(created.map((unit) => unit.name)).toEqual(['Unit 1', 'Unit 2']);
        const createdIds = created.map((unit) => unit.id);
        const reversedIds = [...created].reverse().map((unit) => unit.id);
        expect(
          yield* store.reorderUnits(
            fixtureCourseId,
            fixtureBookId,
            createdIds,
            reversedIds,
          ),
        ).toBe(true);
        expect(
          (yield* store.listUnits(fixtureCourseId, fixtureNow)).map(
            (unit) => unit.name,
          ),
        ).toEqual(['Unit 2', 'Unit 1']);

        expect(
          yield* store.reorderUnits(
            fixtureCourseId,
            fixtureBookId,
            reversedIds,
            [fixtureUnitId],
          ),
        ).toBe(false);
        expect(
          (yield* store.listUnits(fixtureCourseId, fixtureNow)).map(
            (unit) => unit.name,
          ),
        ).toEqual(['Unit 2', 'Unit 1']);
      }),
    );
  });

  it('keeps the first saved order when a stale editor saves afterward', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        const store = yield* CourseStore;
        yield* store.createUnit(fixtureCourseId, fixtureBookId, 'Unit 2');

        const original = yield* store.listUnits(fixtureCourseId, fixtureNow);
        const originalIds = original.map((unit) => unit.id);
        const reversedIds = [...originalIds].reverse();

        expect(
          yield* store.reorderUnits(
            fixtureCourseId,
            fixtureBookId,
            originalIds,
            reversedIds,
          ),
        ).toBe(true);
        expect(
          yield* store.reorderUnits(
            fixtureCourseId,
            fixtureBookId,
            originalIds,
            originalIds,
          ),
        ).toBe(false);
        expect(
          (yield* store.listUnits(fixtureCourseId, fixtureNow)).map(
            (unit) => unit.id,
          ),
        ).toEqual(reversedIds);
      }),
    );
  });
});

describe('CourseStore PostgreSQL book mutations', () => {
  it('adds and renames books without letting two share a name', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        const store = yield* CourseStore;

        const created = yield* store.createBook(
          fixtureCourseId,
          'Découvertes 4',
        );
        expect(created.kind).toBe('created');
        expect(
          yield* store.createBook(fixtureCourseId, 'Découvertes 3'),
        ).toEqual({ kind: 'duplicate' });
        expect(yield* store.createBook(missingBookId, 'Découvertes 1')).toEqual(
          { kind: 'course-missing' },
        );
        expect(
          (yield* store.listBooks(fixtureCourseId)).map((book) => book.name),
        ).toEqual(['Découvertes 3', 'Découvertes 4']);

        if (created.kind !== 'created') {
          return;
        }
        expect(
          yield* store.renameBook(
            fixtureCourseId,
            created.bookId,
            'Découvertes 3',
          ),
        ).toBe('duplicate');
        expect(
          yield* store.renameBook(
            fixtureCourseId,
            created.bookId,
            'Découvertes 4 (Cahier)',
          ),
        ).toBe('renamed');
        expect(
          yield* store.renameBook(
            fixtureCourseId,
            missingBookId,
            'Découvertes 5',
          ),
        ).toBe('book-missing');
        expect(
          (yield* store.listBooks(fixtureCourseId)).map((book) => book.name),
        ).toEqual(['Découvertes 3', 'Découvertes 4 (Cahier)']);
      }),
    );
  });

  it('keeps same-named units apart in different books', async () => {
    await runStoreTest(
      Effect.gen(function* () {
        yield* seedIntroducedCardFixture;
        const store = yield* CourseStore;
        const created = yield* store.createBook(
          fixtureCourseId,
          'Découvertes 4',
        );
        if (created.kind !== 'created') {
          throw new Error('The book was not created.');
        }
        expect(
          yield* store.createUnit(fixtureCourseId, created.bookId, 'Unit 1'),
        ).toBe('created');
        const units = yield* store.listUnits(fixtureCourseId, fixtureNow);
        expect(units.map((unit) => [unit.bookId, unit.name])).toEqual([
          [fixtureBookId, 'Unit 1'],
          [created.bookId, 'Unit 1'],
        ]);
      }),
    );
  });
});
