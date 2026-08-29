import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { Effect, Layer } from 'effect';
import { judgeWithCache } from './judge-cache';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';

const assessmentId = '00000000-0000-0000-0000-000000000003';
const activeModel = 'bedrock-mantle:test-model';
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

describe('judge cache validity', () => {
  it('returns a verdict cached by the active provider and model', async () => {
    let judgeCalls = 0;
    const result = await Effect.runPromise(
      judgeWithCache(request).pipe(
        Effect.provide(
          Layer.merge(
            Layer.succeed(JudgeCacheStore, {
              read: (_key, selector) =>
                Effect.succeed(
                  'model' in selector && selector.model === activeModel
                    ? { assessmentId, verdict, model: selector.model }
                    : undefined,
                ),
              write: () => Effect.void,
              withCriticalSection: (_key, effect) => effect,
            }),
            Layer.succeed(PracticeJudge, {
              model: activeModel,
              judge: () =>
                Effect.sync(() => {
                  judgeCalls += 1;
                  return { verdict, model: activeModel };
                }),
            }),
          ),
        ),
      ),
    );

    expect(result).toEqual({ assessmentId, verdict, model: activeModel });
    expect(judgeCalls).toBe(0);
  });

  it('replaces the assessment identity with an obsolete model', async () => {
    let cached = {
      assessmentId,
      verdict,
      model: 'bedrock-runtime:old-model',
    };
    let judgeCalls = 0;
    const result = await Effect.runPromise(
      judgeWithCache(request).pipe(
        Effect.provide(
          Layer.merge(
            Layer.succeed(JudgeCacheStore, {
              read: (_key, selector) =>
                Effect.succeed(
                  'model' in selector && cached.model === selector.model
                    ? cached
                    : undefined,
                ),
              write: (_key, value) =>
                Effect.sync(() => {
                  cached = value;
                }),
              withCriticalSection: (_key, effect) => effect,
            }),
            Layer.succeed(PracticeJudge, {
              model: activeModel,
              judge: () =>
                Effect.sync(() => {
                  judgeCalls += 1;
                  return { verdict, model: activeModel };
                }),
            }),
          ),
        ),
      ),
    );

    expect(result.verdict).toEqual(verdict);
    expect(result.assessmentId).not.toBe(assessmentId);
    expect(judgeCalls).toBe(1);
    expect(cached.model).toBe(activeModel);
  });
});
