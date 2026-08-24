import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { Effect, Layer } from 'effect';
import {
  PracticeDatabaseError,
  PracticeJudgeError,
} from '../errors/practice-errors';
import { judgeWithCache } from './judge-cache';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';

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

const request = {
  entryId: '00000000-0000-0000-0000-000000000001',
  direction: 'to_target' as const,
  normalizedAnswer: 'falsch',
  input: {
    direction: 'to_target' as const,
    targetLanguage: 'English',
    prompt: 'richtig',
    expectedAnswers: ['correct'],
    givenAnswer: 'wrong',
    entryType: 'word' as const,
  },
};

describe('judgeWithCache', () => {
  it('retains a database failure without calling the provider', async () => {
    const failure = new PracticeDatabaseError({
      operation: 'read judge cache',
      cause: 'offline',
      message: 'cache unavailable',
    });
    let judgeCalls = 0;
    const program = judgeWithCache(request).pipe(
      Effect.provide(
        Layer.merge(
          Layer.succeed(JudgeCacheStore, {
            read: () => Effect.fail(failure),
            write: () => Effect.void,
            withCriticalSection: (_key, effect) => effect,
          }),
          Layer.succeed(PracticeJudge, {
            judge: () =>
              Effect.sync(() => {
                judgeCalls += 1;
                return { verdict, model: 'test-model' };
              }),
          }),
        ),
      ),
      Effect.either,
    );
    const result = await Effect.runPromise(program);
    expect(result._tag).toBe('Left');
    const receivedFailure = result._tag === 'Left' ? result.left : undefined;
    expect(receivedFailure).toBe(failure);
    expect(judgeCalls).toBe(0);
  });

  it('retains a provider failure after a cache miss', async () => {
    const failure = new PracticeJudgeError({
      cause: 'provider offline',
      message: 'judge unavailable',
    });
    const result = await Effect.runPromise(
      judgeWithCache(request).pipe(
        Effect.provide(
          Layer.merge(
            Layer.succeed(JudgeCacheStore, {
              read: () => Effect.succeed(undefined),
              write: () => Effect.void,
              withCriticalSection: (_key, effect) => effect,
            }),
            Layer.succeed(PracticeJudge, {
              judge: () => Effect.fail(failure),
            }),
          ),
        ),
        Effect.either,
      ),
    );
    expect(result._tag).toBe('Left');
    const receivedFailure = result._tag === 'Left' ? result.left : undefined;
    expect(receivedFailure).toBe(failure);
  });

  it('judges once when concurrent misses share a critical section', async () => {
    const mutex = Effect.unsafeMakeSemaphore(1);
    let cached:
      | { readonly verdict: JudgeVerdictData; readonly model: string }
      | undefined;
    let judgeCalls = 0;
    const layer = Layer.merge(
      Layer.succeed(JudgeCacheStore, {
        read: () => Effect.succeed(cached),
        write: (_key, value) =>
          Effect.sync(() => {
            cached = value;
          }),
        withCriticalSection: (_key, effect) => mutex.withPermits(1)(effect),
      }),
      Layer.succeed(PracticeJudge, {
        judge: () =>
          Effect.sync(() => {
            judgeCalls += 1;
            return { verdict, model: 'test-model' };
          }),
      }),
    );
    const results = await Effect.runPromise(
      Effect.all([judgeWithCache(request), judgeWithCache(request)], {
        concurrency: 'unbounded',
      }).pipe(Effect.provide(layer)),
    );
    expect(results).toEqual([verdict, verdict]);
    expect(judgeCalls).toBe(1);
  });
});
