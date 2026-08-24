import { describe, expect, it } from 'bun:test';
import {
  commitVerifiedPage,
  PageAlreadyVerifiedError,
  type RunVerificationTransaction,
} from './verification-commit';

describe('commitVerifiedPage', () => {
  it('creates one entry set under concurrent verification requests', async () => {
    const store = { pending: true, entrySets: 0 };
    let queued = Promise.resolve();
    const transaction: RunVerificationTransaction<number> = async (work) => {
      const predecessor = queued;
      let release: () => void = () => undefined;
      queued = new Promise<void>((resolve) => {
        release = resolve;
      });
      await predecessor;
      const draft = { ...store };
      try {
        const result = await work({
          claimPage: () => {
            if (!draft.pending) {
              return Promise.resolve(false);
            }
            draft.pending = false;
            return Promise.resolve(true);
          },
          insertEntries: () => {
            draft.entrySets += 1;
            return Promise.resolve(draft.entrySets);
          },
        });
        Object.assign(store, draft);
        return result;
      } finally {
        release();
      }
    };

    const results = await Promise.allSettled([
      commitVerifiedPage(transaction),
      commitVerifiedPage(transaction),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === 'rejected'),
    ).toMatchObject({ reason: expect.any(PageAlreadyVerifiedError) });
    expect(store).toEqual({ pending: false, entrySets: 1 });
  });
});
