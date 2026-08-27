import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { Effect } from 'effect';
import { StaleAnswerSubmissionError } from '../errors/practice-errors';
import { commitGradedAnswer, type RunReviewTransaction } from './review-commit';

type Store = { revision: number; reviews: number; alternatives: number };

const verdict = (
  overrides: Partial<JudgeVerdictData> = {},
): JudgeVerdictData => ({
  correct: true,
  acceptAsAlternative: true,
  meaning: { ok: true, note: null },
  grammar: { ok: true, note: null },
  idiomaticity: { ok: true, note: null },
  spelling: { ok: true, note: null },
  intendedConstruction: { ok: true, note: null },
  explanation: 'Passt.',
  ...overrides,
});

const makeTransactionalStore = () => {
  const store: Store = { revision: 0, reviews: 0, alternatives: 0 };
  const mutex = Effect.unsafeMakeSemaphore(1);
  const transaction =
    (
      expectedRevision: number,
      failReview = false,
    ): RunReviewTransaction<unknown> =>
    (work) =>
      mutex.withPermits(1)(
        Effect.gen(function* () {
          const draft = { ...store };
          const result = yield* work({
            advanceCard: () =>
              Effect.sync(() => {
                if (draft.revision !== expectedRevision) {
                  return;
                }
                draft.revision += 1;
                return draft.revision;
              }),
            insertAcceptedAlternative: () =>
              Effect.sync(() => {
                draft.alternatives += 1;
              }),
            insertReview: () =>
              failReview
                ? Effect.fail(new Error('review insert failed'))
                : Effect.sync(() => {
                    draft.reviews += 1;
                  }),
          });
          Object.assign(store, draft);
          return result;
        }),
      );
  return { store, transaction };
};

describe('commitGradedAnswer', () => {
  it('accepts one of two concurrent submissions for the same revision', async () => {
    const { store, transaction } = makeTransactionalStore();
    const results = await Promise.all([
      Effect.runPromise(
        commitGradedAnswer(transaction(0), verdict(), true).pipe(Effect.either),
      ),
      Effect.runPromise(
        commitGradedAnswer(transaction(0), verdict(), true).pipe(Effect.either),
      ),
    ]);
    const accepted = results.filter((result) => result._tag === 'Right');
    expect(accepted).toHaveLength(1);
    expect(
      accepted.at(0)?._tag === 'Right' ? accepted.at(0)?.right : undefined,
    ).toBe(1);
    const rejection = results.find((result) => result._tag === 'Left');
    expect(rejection?._tag).toBe('Left');
    const failure = rejection?._tag === 'Left' ? rejection.left : undefined;
    expect(failure).toBeInstanceOf(StaleAnswerSubmissionError);
    expect(store).toEqual({ revision: 1, reviews: 1, alternatives: 1 });
  });

  it('claims the revision for a held-back answer', async () => {
    const { store, transaction } = makeTransactionalStore();
    const revision = await Effect.runPromise(
      commitGradedAnswer(transaction(0), verdict(), false),
    );
    expect(revision).toBe(1);
    expect(store).toEqual({ revision: 1, reviews: 1, alternatives: 1 });
  });

  it('rolls back the card and alternative when review insertion fails', async () => {
    const { store, transaction } = makeTransactionalStore();
    await expect(
      Effect.runPromise(
        commitGradedAnswer(transaction(0, true), verdict(), true),
      ),
    ).rejects.toThrow('review insert failed');
    expect(store).toEqual({ revision: 0, reviews: 0, alternatives: 0 });
  });

  it.each([
    verdict({ correct: false }),
    verdict({ spelling: { ok: false, note: 'Tippfehler' } }),
  ])('rechecks the alternative predicate before persistence', async (value) => {
    const { store, transaction } = makeTransactionalStore();
    await Effect.runPromise(commitGradedAnswer(transaction(0), value, true));
    expect(store.alternatives).toBe(0);
    expect(store.reviews).toBe(1);
  });
});
