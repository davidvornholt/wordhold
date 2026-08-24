import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { PageAlreadyVerifiedError } from '../errors/page-already-verified-error';
import { commitVerifiedPage } from './verification-commit';

describe('commitVerifiedPage', () => {
  it('creates one entry set under serialized concurrent transactions', async () => {
    const store = { pending: true, entrySets: 0 };
    let queued = Promise.resolve();
    const transaction = async () => {
      const predecessor = queued;
      let release: () => void = () => undefined;
      queued = new Promise<void>((resolve) => {
        release = resolve;
      });
      await predecessor;
      const draft = { ...store };
      try {
        const result = await Effect.runPromise(
          commitVerifiedPage({
            claimPage: Effect.sync(() => {
              if (!draft.pending) {
                return false;
              }
              draft.pending = false;
              return true;
            }),
            insertEntries: Effect.sync(() => {
              draft.entrySets += 1;
              return draft.entrySets;
            }),
          }),
        );
        Object.assign(store, draft);
        return result;
      } finally {
        release();
      }
    };

    const results = await Promise.allSettled([transaction(), transaction()]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === 'rejected'),
    ).toMatchObject({
      reason: expect.objectContaining({
        message: 'Diese Seite wurde bereits importiert.',
      }),
    });
    expect(store).toEqual({ pending: false, entrySets: 1 });

    const failure = await Effect.runPromise(
      Effect.flip(
        commitVerifiedPage({
          claimPage: Effect.succeed(false),
          insertEntries: Effect.succeed(0),
        }),
      ),
    );
    expect(failure).toBeInstanceOf(PageAlreadyVerifiedError);
  });
});
