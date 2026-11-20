import { expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  testTimeZone,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { migrateDatabase } from './migrate';

const answeredAt = '2026-11-20T09:00:00Z';

// One card FSRS-7 gave 00:15 in Berlin three days after its answer, and one
// on a learning step ten minutes after it.
const insertTimedCards = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, name, target_language)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Englisch', 'en')
  `;
  yield* sql`
    insert into entries (id, course_id, target_text, native_text)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'happy', 'glücklich')
  `;
  yield* sql`
    insert into cards (id, entry_id, direction, introduced_at, state, due_at,
      stability, stability_fast, difficulty, reps, scheduled_days, last_reviewed_at)
    values
      ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'to_target', '2026-11-01T07:00:00Z', 'review', '2026-11-22T23:15:00Z',
        3.1, 1.2, 5, 3, 2.6, ${answeredAt}),
      ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'to_native', '2026-11-20T08:50:00Z', 'learning', '2026-11-20T09:10:00Z',
        0.4, 0.2, 6, 1, 0, ${answeredAt})
  `;
});

const loadDueDates = Effect.gen(function* () {
  const sql = yield* Database;
  return yield* sql<{
    readonly direction: string;
    readonly dueAt: Date;
    readonly revision: number;
  }>`
    select direction, due_at as "dueAt", revision from cards order by due_at desc
  `;
});

it('starts a card due on a later day at midnight and keeps a step today', async () => {
  const cards = await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        yield* insertTimedCards;
        yield* migrateDatabase({ url: database.url, timeZone: testTimeZone });
        yield* migrateDatabase({ url: database.url, timeZone: testTimeZone });
        return yield* loadDueDates;
      }).pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );

  expect(cards).toEqual([
    {
      direction: 'to_target',
      dueAt: new Date('2026-11-22T23:00:00Z'),
      revision: 0,
    },
    {
      direction: 'to_native',
      dueAt: new Date('2026-11-20T09:10:00Z'),
      revision: 0,
    },
  ]);
});
