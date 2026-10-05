import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import { Effect, Layer, Semaphore } from 'effect';
import {
  PracticeDatabaseError,
  PracticeJudgeError,
} from '../errors/practice-errors';
import type { CachedVerdict } from '../schemas/practice-models';
import { judgeWithCache } from './judge-cache';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';

const verdict: JudgeVerdictData = {
  correct: false,
  acceptAsAlternative: false,
  meaning: { ok: false, note: null },
  grammar: { ok: true, note: null },
  idiomaticity: { ok: true, note: null },
  spelling: { ok: true, note: null },
  intendedConstruction: { ok: true, note: null },
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
            model: 'vertex:test-model',
            judge: () =>
              Effect.sync(() => {
                judgeCalls += 1;
                return { verdict, model: 'test-model' };
              }),
          }),
        ),
      ),
      Effect.result,
      Effect.provide(untrackedAiUsage),
    );
    const result = await Effect.runPromise(program);
    expect(result._tag).toBe('Failure');
    const receivedFailure =
      result._tag === 'Failure' ? result.failure : undefined;
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
              model: 'vertex:test-model',
              judge: () => Effect.fail(failure),
            }),
          ),
        ),
        Effect.result,
        Effect.provide(untrackedAiUsage),
      ),
    );
    expect(result._tag).toBe('Failure');
    const receivedFailure =
      result._tag === 'Failure' ? result.failure : undefined;
    expect(receivedFailure).toBe(failure);
  });
  it('judges once when concurrent misses share a critical section', async () => {
    const mutex = Semaphore.makeUnsafe(1);
    let cached: CachedVerdict | undefined;
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
        model: 'vertex:test-model',
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
      }).pipe(Effect.provide(layer), Effect.provide(untrackedAiUsage)),
    );
    expect(results[0]?.verdict).toEqual(verdict);
    expect(results[1]).toEqual(results[0]);
    expect(judgeCalls).toBe(1);
  });
});
