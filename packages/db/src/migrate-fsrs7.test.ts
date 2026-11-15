import { expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import postgres from 'postgres';
import { replayReviews } from './fsrs';
import { DatabaseMigrationError, migrateDatabase } from './migrate';

const fsrs6Answers = [
  { reviewedAt: new Date('2026-09-01T08:00:00Z'), rating: 3 },
  { reviewedAt: new Date('2026-09-05T08:00:00Z'), rating: 3 },
  { reviewedAt: new Date('2026-09-20T08:00:00Z'), rating: 1 },
  { reviewedAt: new Date('2026-09-20T08:12:00Z'), rating: 3 },
  { reviewedAt: new Date('2026-10-01T08:00:00Z'), rating: 4 },
] as const;

const insertFsrs6Card = Effect.gen(function* () {
  const sql = yield* Database;
  yield* sql`
    insert into courses (id, name, target_language)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Englisch', 'en')
  `;
  yield* sql`
    insert into entries (id, course_id, target_text, native_text)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'happy', 'glücklich')
  `;
  // The memory and due date FSRS-6 left after those answers.
  yield* sql`
    insert into cards (id, entry_id, direction, introduced_at, state, due_at,
      stability, difficulty, reps, lapses, scheduled_days, last_reviewed_at)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'to_target', '2026-09-01T07:00:00Z', 'review', '2026-11-20T08:00:00Z',
      48.2, 4.1, 5, 1, 50, '2026-10-01T08:00:00Z')
  `;
});

const insertFsrs6Answers = Effect.gen(function* () {
  const sql = yield* Database;
  for (const answer of fsrs6Answers) {
    yield* sql`
      insert into reviews (card_id, reviewed_at, rating, answer_text)
      values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', ${answer.reviewedAt}, ${answer.rating}, 'happy')
    `;
  }
});

const loadRebuiltCard = Effect.gen(function* () {
  const sql = yield* Database;
  const rows = yield* sql<{
    readonly state: string;
    readonly dueAt: Date | null;
    readonly stability: number | null;
    readonly stabilityFast: number | null;
    readonly difficulty: number | null;
    readonly reps: number;
    readonly lapses: number;
    readonly scheduledDays: number;
    readonly learningSteps: number;
    readonly lastReviewedAt: Date | null;
    readonly revision: number;
  }>`
    select state, due_at as "dueAt", stability, stability_fast as "stabilityFast",
      difficulty, reps, lapses, scheduled_days as "scheduledDays",
      learning_steps as "learningSteps", last_reviewed_at as "lastReviewedAt",
      revision
    from cards
  `;
  return rows[0];
});

it('reschedules FSRS-6 cards from their answers under FSRS-7', async () => {
  const card = await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        yield* insertFsrs6Card;
        yield* insertFsrs6Answers;
        yield* migrateDatabase(database.url);
        yield* migrateDatabase(database.url);
        return yield* loadRebuiltCard;
      }).pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );

  const expected = replayReviews(fsrs6Answers);
  expect(expected.stabilityFast).not.toBeNull();
  expect(card).toEqual({ ...expected, revision: 1 });
  expect(card?.dueAt).not.toEqual(new Date('2026-11-20T08:00:00Z'));
});

const answeredDuringDeploy = {
  reviewedAt: new Date('2026-11-01T08:00:00Z'),
  rating: 1,
} as const;

// Polls one query at a time until the migration waits for a lock.
const waitForBlockedMigration = async (
  client: postgres.Sql,
  attemptsLeft = 500,
): Promise<void> => {
  const waiting = await client`
    select 1 from pg_stat_activity
    where datname = current_database() and wait_event_type = 'Lock'
  `;
  if (waiting.length > 0) {
    return;
  }
  if (attemptsLeft === 0) {
    throw new Error('The migration never waited for the answered card.');
  }
  await globalThis.Bun.sleep(10);
  return waitForBlockedMigration(client, attemptsLeft - 1);
};

// The previous app version keeps answering during a deploy. This answer is
// written the way it writes one, and commits only once the migration waits
// for the card.
const migrateDuringAnswer = (url: string) =>
  Effect.acquireUseRelease(
    Effect.sync(() => postgres(url, { max: 2, onnotice: () => undefined })),
    (client) =>
      Effect.tryPromise({
        try: async () => {
          const written = Promise.withResolvers<void>();
          const commit = Promise.withResolvers<void>();
          const answer = client.begin(async (transaction) => {
            await transaction`
              insert into reviews (card_id, reviewed_at, rating, answer_text)
              values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                ${answeredDuringDeploy.reviewedAt}, ${answeredDuringDeploy.rating}, 'sad')
            `;
            await transaction`
              update cards set state = 'relearning', lapses = lapses + 1,
                reps = reps + 1, last_reviewed_at = ${answeredDuringDeploy.reviewedAt},
                revision = revision + 1
              where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' and revision = 0
            `;
            written.resolve();
            await commit.promise;
          });
          await written.promise;
          const migration = Effect.runPromise(migrateDatabase(url));
          try {
            await Promise.race([waitForBlockedMigration(client), migration]);
          } finally {
            commit.resolve();
          }
          await answer;
          await migration;
        },
        catch: (cause) =>
          new Error('Could not migrate during an answer.', { cause }),
      }),
    (client) => Effect.promise(() => client.end()),
  );

it('reschedules a card answered while the migration runs with that answer', async () => {
  const card = await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        yield* insertFsrs6Card;
        yield* insertFsrs6Answers;
        yield* migrateDuringAnswer(database.url);
        return yield* loadRebuiltCard;
      }).pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );

  expect(card).toEqual({
    ...replayReviews([...fsrs6Answers, answeredDuringDeploy]),
    revision: 2,
  });
});

it('refuses to reschedule a card whose answers are missing', async () => {
  const error = await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        yield* insertFsrs6Card;
        return yield* migrateDatabase(database.url).pipe(Effect.flip);
      }).pipe(Effect.provide(testDatabaseLayer(database.url))),
    ),
  );

  expect(error).toBeInstanceOf(DatabaseMigrationError);
});
