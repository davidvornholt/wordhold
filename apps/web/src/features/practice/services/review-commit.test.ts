import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { Effect } from 'effect';
import { commitGradedAnswer, type RunReviewTransaction } from './review-commit';

type Store = { revision: number; reviews: number; alternatives: number };

const verdict = (
  overrides: Partial<JudgeVerdictData> = {},
): JudgeVerdictData => ({
  correct: true,
  acceptAsAlternative: true,
  otherWording: false,
  meaning: { ok: true, note: null },
  grammar: { ok: true, note: null },
  idiomaticity: { ok: true, note: null },
  spelling: { ok: true, note: null },
  intendedConstruction: { ok: true, note: null },
  explanation: 'Passt.',
  ...overrides,
});

// Concurrency and rollback run against PostgreSQL in
// review-store-transaction-live.test.ts.
const makeStore = () => {
  const store: Store = { revision: 0, reviews: 0, alternatives: 0 };
  const transaction: RunReviewTransaction<never> = (work) =>
    work({
      advanceCard: () =>
        Effect.sync(() => {
          store.revision += 1;
          return store.revision;
        }),
      insertAcceptedAlternative: () =>
        Effect.sync(() => {
          store.alternatives += 1;
          return true;
        }),
      insertReview: () =>
        Effect.sync(() => {
          store.reviews += 1;
        }),
      entryKnown: () => Effect.succeed(true),
    });
  return { store, transaction };
};

describe('commitGradedAnswer', () => {
  it.each([
    verdict({ correct: false }),
    verdict({ spelling: { ok: false, note: 'Tippfehler' } }),
  ])('rechecks the alternative predicate before persistence', async (value) => {
    const { store, transaction } = makeStore();
    await Effect.runPromise(commitGradedAnswer(transaction, value, true));
    expect(store.alternatives).toBe(0);
    expect(store.reviews).toBe(1);
  });
});
