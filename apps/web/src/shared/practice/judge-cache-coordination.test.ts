import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { coordinateJudgeCacheMiss } from './judge-cache-coordination';

const verdict: JudgeVerdictData = {
  correct: false,
  acceptAsAlternative: false,
  meaning: { ok: false },
  grammar: { ok: true },
  idiomaticity: { ok: true },
  spelling: { ok: true },
  intendedConstruction: { ok: true },
  explanation: 'Das bedeutet etwas anderes.',
};

const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};

describe('coordinateJudgeCacheMiss', () => {
  it('judges one time when concurrent requests miss the same cache key', async () => {
    let cached: { verdict: JudgeVerdictData; model: string } | undefined;
    let pending = Promise.resolve();
    let judgeCalls = 0;
    const judgeStarted = deferred();
    const releaseJudge = deferred();
    const dependencies = {
      read: async () => cached,
      withCriticalSection: async (
        work: (cache: {
          read: () => Promise<typeof cached>;
          write: (value: NonNullable<typeof cached>) => Promise<void>;
        }) => Promise<JudgeVerdictData>,
      ) => {
        const predecessor = pending;
        let release: () => void = () => undefined;
        pending = new Promise<void>((complete) => {
          release = complete;
        });
        await predecessor;
        try {
          return await work({
            read: async () => cached,
            write: (value) => {
              cached = value;
              return Promise.resolve();
            },
          });
        } finally {
          release();
        }
      },
      judge: async () => {
        judgeCalls += 1;
        judgeStarted.resolve();
        await releaseJudge.promise;
        return { verdict, model: 'test-model' };
      },
    };

    const first = coordinateJudgeCacheMiss(dependencies);
    const second = coordinateJudgeCacheMiss(dependencies);
    await judgeStarted.promise;
    releaseJudge.resolve();

    expect(await Promise.all([first, second])).toEqual([verdict, verdict]);
    expect(judgeCalls).toBe(1);
    expect(cached).toEqual({ verdict, model: 'test-model' });
  });
});
