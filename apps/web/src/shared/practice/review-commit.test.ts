import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import {
  commitGradedAnswer,
  type RunReviewTransaction,
  StaleAnswerSubmissionError,
} from './review-commit';

type Store = {
  revision: number;
  reviews: number;
  alternatives: number;
};

const verdict = (
  overrides: Partial<JudgeVerdictData> = {},
): JudgeVerdictData => ({
  correct: true,
  acceptAsAlternative: true,
  meaning: { ok: true },
  grammar: { ok: true },
  idiomaticity: { ok: true },
  spelling: { ok: true },
  intendedConstruction: { ok: true },
  explanation: 'Passt.',
  ...overrides,
});

const makeTransactionalStore = () => {
  const store: Store = { revision: 0, reviews: 0, alternatives: 0 };
  let pending = Promise.resolve();

  const transaction =
    (expectedRevision: number, failReview = false): RunReviewTransaction =>
    async (work) => {
      const predecessor = pending;
      let release: () => void = () => undefined;
      pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      await predecessor;
      const draft = { ...store };
      try {
        await work({
          advanceCard: () => {
            if (draft.revision !== expectedRevision) {
              return Promise.resolve(false);
            }
            draft.revision += 1;
            return Promise.resolve(true);
          },
          insertAcceptedAlternative: () => {
            draft.alternatives += 1;
            return Promise.resolve();
          },
          insertReview: () => {
            if (failReview) {
              return Promise.reject(new Error('review insert failed'));
            }
            draft.reviews += 1;
            return Promise.resolve();
          },
        });
        Object.assign(store, draft);
      } finally {
        release();
      }
    };

  return { store, transaction };
};

describe('commitGradedAnswer', () => {
  it('accepts one of two concurrent submissions for the same revision', async () => {
    const { store, transaction } = makeTransactionalStore();
    const results = await Promise.allSettled([
      commitGradedAnswer(transaction(0), verdict()),
      commitGradedAnswer(transaction(0), verdict()),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejection = results.find((result) => result.status === 'rejected');
    expect(rejection).toMatchObject({
      reason: expect.any(StaleAnswerSubmissionError),
    });
    expect(store).toEqual({ revision: 1, reviews: 1, alternatives: 1 });
  });

  it('rolls back the card and alternative when review insertion fails', async () => {
    const { store, transaction } = makeTransactionalStore();
    await expect(
      commitGradedAnswer(transaction(0, true), verdict()),
    ).rejects.toThrow('review insert failed');
    expect(store).toEqual({ revision: 0, reviews: 0, alternatives: 0 });
  });

  it.each([
    verdict({ correct: false }),
    verdict({ spelling: { ok: false, note: 'Tippfehler' } }),
  ])('rechecks the alternative predicate before persistence', async (value) => {
    const { store, transaction } = makeTransactionalStore();
    await commitGradedAnswer(transaction(0), value as JudgeVerdictData);
    expect(store.alternatives).toBe(0);
    expect(store.reviews).toBe(1);
  });
});
