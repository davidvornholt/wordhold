import { describe, expect, it } from 'bun:test';
import { AiUsage } from '@wordhold/ai/usage';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
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
        Effect.provide(UsageLedger.live.pipe(Layer.provide(databaseLayer))),
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
});
