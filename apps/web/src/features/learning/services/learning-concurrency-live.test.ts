import { expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { LearningStore } from './learning-store';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const entryId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const targetCard = '11111111-1111-4111-8111-111111111111';
const nativeCard = '22222222-2222-4222-8222-222222222222';

it('holds back a new relation after concurrent returns of both translations', async () => {
  await Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      const layer = Layer.merge(
        databaseLayer,
        LearningStore.live.pipe(Layer.provide(databaseLayer)),
      );
      return Effect.gen(function* () {
        const sql = yield* Database;
        const store = yield* LearningStore;
        yield* sql`
          insert into courses (id, name, target_language, directions)
          values (${courseId}, 'French', 'fr', '{to_target,to_native}')
        `;
        yield* sql`
          insert into entries (id, course_id, target_text, native_text)
          values (${entryId}, ${courseId}, 'voir', 'sehen')
        `;
        yield* sql`
          insert into cards (id, entry_id, direction, introduced_at)
          values (${targetCard}, ${entryId}, 'to_target', now()),
            (${nativeCard}, ${entryId}, 'to_native', now()),
            (gen_random_uuid(), ${entryId}, 'to_synonym', now())
        `;
        const firstReturned = Promise.withResolvers<number>();
        const releaseFirst = Promise.withResolvers<void>();
        let secondReturned = false;
        yield* Effect.all(
          [
            sql.withTransaction(
              Effect.gen(function* () {
                const [backend] = yield* sql<{ readonly pid: number }>`
                  select pg_backend_pid() as pid
                `;
                yield* store.returnToLearning(courseId, [targetCard]);
                firstReturned.resolve(backend?.pid ?? 0);
                yield* Effect.promise(() => releaseFirst.promise);
              }),
            ),
            Effect.gen(function* () {
              yield* Effect.promise(() => firstReturned.promise);
              yield* store.returnToLearning(courseId, [nativeCard]);
              secondReturned = true;
            }),
            Effect.gen(function* () {
              const pid = yield* Effect.promise(() => firstReturned.promise);
              // Before the fix the second return completes against stale
              // state; with entry locking it waits for the first commit.
              let readyToCommit = false;
              while (!readyToCommit) {
                const [waiting] = yield* sql<{ readonly blocked: boolean }>`
                  select exists (
                    select 1 from pg_stat_activity
                    where datname = current_database()
                      and ${pid} = any(pg_blocking_pids(pid))
                  ) as blocked
                `;
                readyToCommit = secondReturned || waiting?.blocked === true;
                if (!readyToCommit) {
                  yield* Effect.sleep('10 millis');
                }
              }
              releaseFirst.resolve();
            }),
          ],
          { concurrency: 'unbounded' },
        ).pipe(Effect.timeout('3 seconds'));
        const cards = yield* sql<{ readonly introduced: boolean }>`
          select introduced_at is not null as introduced from cards
          where entry_id = ${entryId} order by direction
        `;
        expect(cards.map((card) => card.introduced)).toEqual([
          false,
          false,
          false,
        ]);
      }).pipe(Effect.provide(layer));
    }),
  );
});
