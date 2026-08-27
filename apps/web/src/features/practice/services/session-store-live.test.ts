import { describe, expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  dueEntryId,
  fixtureCourseId,
  fixtureNow,
  fixtureUnitId,
  freshEntryId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { PracticeSessionStore } from './session-store';

describe('PracticeSessionStore introduction contract', () => {
  it('offers only introduced cards in their current queue', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const store = yield* PracticeSessionStore;
          const session = yield* store.load(
            fixtureCourseId,
            'both',
            fixtureNow,
          );
          expect(session.due.map((item) => item.entryId)).toEqual([dueEntryId]);
          expect(session.fresh.map((item) => item.entryId)).toEqual([
            freshEntryId,
            freshEntryId,
          ]);
        }).pipe(
          Effect.provide(
            PracticeSessionStore.live.pipe(Layer.provide(databaseLayer)),
          ),
          Effect.provide(databaseLayer),
        );
      }),
    );
  });

  it('keeps disabled directions out of mixed and explicit queues', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          const store = yield* PracticeSessionStore;
          yield* sql`
            update courses
            set directions = '{to_native}'::answer_direction[]
            where id = ${fixtureCourseId}
          `;

          const mixed = yield* store.load(fixtureCourseId, 'both', fixtureNow);
          expect(mixed.due).toEqual([]);
          expect(mixed.fresh.map((item) => item.direction)).toEqual([
            'to_native',
          ]);
          const disabled = yield* store.load(
            fixtureCourseId,
            'to_target',
            fixtureNow,
          );
          expect(disabled).toEqual({ due: [], fresh: [] });
        }).pipe(
          Effect.provide(
            PracticeSessionStore.live.pipe(Layer.provide(databaseLayer)),
          ),
          Effect.provide(databaseLayer),
        );
      }),
    );
  });

  it('loads every introduced card in one unit and respects directions', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const sql = yield* Database;
          const store = yield* PracticeSessionStore;

          const mixed = yield* store.loadUnit(fixtureUnitId, 'both');
          expect(
            mixed
              .map(({ entryId, direction }) => `${entryId}:${direction}`)
              .sort(),
          ).toEqual(
            [
              `${dueEntryId}:to_native`,
              `${dueEntryId}:to_target`,
              `${freshEntryId}:to_native`,
              `${freshEntryId}:to_target`,
            ].sort(),
          );
          const target = yield* store.loadUnit(fixtureUnitId, 'to_target');
          expect(target.map(({ direction }) => direction)).toEqual([
            'to_target',
            'to_target',
          ]);

          yield* sql`
            update courses
            set directions = '{to_native}'::answer_direction[]
            where id = ${fixtureCourseId}
          `;
          expect(yield* store.loadUnit(fixtureUnitId, 'to_target')).toEqual([]);
        }).pipe(
          Effect.provide(
            PracticeSessionStore.live.pipe(Layer.provide(databaseLayer)),
          ),
          Effect.provide(databaseLayer),
        );
      }),
    );
  });
});
