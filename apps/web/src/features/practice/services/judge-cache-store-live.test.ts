import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  firstReviewEntryId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { JudgeCacheStore } from './judge-cache-store';

const verdict: JudgeVerdictData = {
  correct: false,
  acceptAsAlternative: false,
  meaning: { ok: true, note: null },
  grammar: { ok: true, note: null },
  idiomaticity: { ok: true, note: null },
  spelling: { ok: false, note: 'Tippfehler' },
  intendedConstruction: { ok: true, note: null },
  explanation: 'Tippfehler.',
};

describe('JudgeCacheStore assessment identity', () => {
  it('invalidates an assessment ID when a model replaces its verdict', async () => {
    await Effect.runPromise(
      withMigratedTestDatabase((database) => {
        const databaseLayer = testDatabaseLayer(database.url);
        const cacheLayer = JudgeCacheStore.live.pipe(
          Layer.provide(databaseLayer),
        );
        return Effect.gen(function* () {
          yield* seedIntroducedCardFixture;
          const cache = yield* JudgeCacheStore;
          const key = {
            entryId: firstReviewEntryId,
            direction: 'to_target' as const,
            normalizedAnswer: 'livr',
          };
          const first = {
            assessmentId: '11111111-1111-4111-8111-111111111111',
            verdict,
            model: 'first-model',
          };
          const replacement = {
            assessmentId: '22222222-2222-4222-8222-222222222222',
            verdict,
            model: 'replacement-model',
          };

          yield* cache.write(key, first);
          expect(
            yield* cache.read(key, { assessmentId: first.assessmentId }),
          ).toEqual(first);

          yield* cache.write(key, replacement);
          expect(
            yield* cache.read(key, { assessmentId: first.assessmentId }),
          ).toBeUndefined();
          expect(
            yield* cache.read(key, {
              assessmentId: replacement.assessmentId,
            }),
          ).toEqual(replacement);
        }).pipe(Effect.provide(cacheLayer), Effect.provide(databaseLayer));
      }),
    );
  });
});
