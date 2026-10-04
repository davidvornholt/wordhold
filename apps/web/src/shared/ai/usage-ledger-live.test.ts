import { describe, expect, it } from 'bun:test';
import { AiUsage, metered } from '@wordhold/ai/usage';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Schedule } from 'effect';
import { seedOwner } from '../testing/owner-fixture';
import { billedTo, UsageLedger } from './usage-ledger';

const memberId = 'anna';

const runWithLedger = <A, E>(
  work: Effect.Effect<A, E, Database | UsageLedger>,
): Promise<A> =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return work.pipe(
        Effect.provide(UsageLedger.live(databaseLayer)),
        Effect.provide(databaseLayer),
      );
    }),
  );

const seedMember = (enabled: boolean) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    yield* seedOwner(memberId);
    yield* sql`insert into members (user_id, name, enabled)
      values (${memberId}, 'Anna', ${enabled})`;
  });

const speech = Effect.flatMap(AiUsage, (usage) =>
  usage.start({ operation: 'speech', provider: 'polly', model: 'generative' }),
);

describe('UsageLedger', () => {
  it('records a request for the person and stores its estimated cost', async () => {
    await runWithLedger(
      Effect.gen(function* () {
        const sql = yield* Database;
        yield* seedMember(true);

        const record = yield* billedTo(memberId)(speech);
        yield* record.settle({
          succeeded: true,
          usage: { characters: 1000, raw: { characters: 1000 } },
        });

        const rows = yield* sql<{
          readonly userId: string;
          readonly status: string;
          readonly characters: number;
          readonly estimatedUsd: string;
        }>`select user_id as "userId", status, characters,
            estimated_usd::text as "estimatedUsd"
          from ai_usage`;
        expect(rows).toEqual([
          {
            userId: memberId,
            status: 'succeeded',
            characters: 1000,
            estimatedUsd: '0.03000000',
          },
        ]);
      }),
    );
  });

  it('refuses requests for a suspended person before they are sent', async () => {
    await runWithLedger(
      Effect.gen(function* () {
        const sql = yield* Database;
        yield* seedMember(false);

        const failure = yield* Effect.flip(billedTo(memberId)(speech));

        expect(failure.message).toBe('Dieses Konto hat keinen Zugang mehr.');
        expect(yield* sql`select 1 from ai_usage`).toHaveLength(0);
      }),
    );
  });

  it('keeps failed paid usage after the application transaction rolls back', async () => {
    await runWithLedger(
      Effect.gen(function* () {
        const sql = yield* Database;
        yield* seedMember(true);

        const request = metered(
          { operation: 'speech', provider: 'polly', model: 'generative' },
          (report) =>
            Effect.gen(function* () {
              report({ characters: 1000, raw: { characters: 1000 } });
              return yield* Effect.fail('Provider returned an invalid answer');
            }),
        );
        const failure = yield* Effect.flip(
          sql.withTransaction(billedTo(memberId)(request)),
        );

        expect(failure).toBe('Provider returned an invalid answer');
        const rows = yield* sql<{
          readonly userId: string;
          readonly status: string;
          readonly characters: number;
          readonly estimatedUsd: string;
        }>`select user_id as "userId", status, characters,
            estimated_usd::text as "estimatedUsd"
          from ai_usage`;
        expect(rows).toEqual([
          {
            userId: memberId,
            status: 'failed',
            characters: 1000,
            estimatedUsd: '0.03000000',
          },
        ]);
      }),
    );
  });

  it('accepts another request after its idle database connection disconnects', async () => {
    await runWithLedger(
      Effect.gen(function* () {
        const sql = yield* Database;
        yield* seedMember(true);
        const first = yield* billedTo(memberId)(speech);
        yield* first.settle({ succeeded: true, usage: undefined });

        const terminated = yield* sql<{ terminated: boolean }>`
          select pg_terminate_backend(pid, 1000) as terminated
          from pg_stat_activity
          where datname = current_database() and pid <> pg_backend_pid()
            and state = 'idle' and query like '%update ai_usage set%'`;
        expect(terminated).toEqual([{ terminated: true }]);
        // The driver's socket notification can lag behind backend termination;
        // recovery must happen on this same layer without restarting it.
        const next = yield* billedTo(memberId)(speech).pipe(
          Effect.retry({ times: 20, schedule: Schedule.spaced('50 millis') }),
        );
        yield* next.settle({ succeeded: true, usage: undefined });
        const rows = yield* sql`select status from ai_usage`;
        expect(rows).toEqual([
          { status: 'succeeded' },
          { status: 'succeeded' },
        ]);
      }),
    );
  });
});
