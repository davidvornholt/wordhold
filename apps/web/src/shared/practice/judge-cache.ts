import { Judge } from '@wordhold/ai/judge';
import {
  type JudgeInput,
  JudgeVerdict,
  type JudgeVerdictData,
} from '@wordhold/ai/judge/schema';
import type { AnswerDirection } from '@wordhold/db/schema/entries';
import { judgeCache } from '@wordhold/db/schema/practice';
import { and, eq, sql } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import { judgeRuntime } from '../ai/runtime';
import { db } from '../db/server';
import {
  type CachedJudgeVerdict,
  coordinateJudgeCacheMiss,
} from './judge-cache-coordination';

type JudgeRequest = {
  readonly entryId: string;
  readonly direction: AnswerDirection;
  readonly normalizedAnswer: string;
  readonly input: JudgeInput;
};

// Verdicts are cached per (entry, direction, normalized answer): repeating
// the same wrong answer never re-bills a model call. Returns null when the
// judge is unreachable. The caller must then leave the card ungraded.
export const judgeWithCache = async (
  request: JudgeRequest,
): Promise<JudgeVerdictData | null> => {
  const cacheCondition = and(
    eq(judgeCache.entryId, request.entryId),
    eq(judgeCache.direction, request.direction),
    eq(judgeCache.normalizedAnswer, request.normalizedAnswer),
  );
  const lockKey = JSON.stringify([
    request.entryId,
    request.direction,
    request.normalizedAnswer,
  ]);
  const decodeCached = (
    cached: { readonly verdict: unknown; readonly model: string } | undefined,
  ): CachedJudgeVerdict | undefined =>
    cached === undefined
      ? undefined
      : {
          verdict: Schema.decodeUnknownSync(JudgeVerdict)(cached.verdict),
          model: cached.model,
        };
  try {
    return await coordinateJudgeCacheMiss({
      read: async () => {
        const [cached] = await db
          .select({ verdict: judgeCache.verdict, model: judgeCache.model })
          .from(judgeCache)
          .where(cacheCondition);
        return decodeCached(cached);
      },
      withCriticalSection: async (work) =>
        db.transaction(async (tx) => {
          // The transaction-scoped advisory lock coordinates this cache key
          // across every server process before any process calls the model.
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
          );
          return work({
            read: async () => {
              const [cached] = await tx
                .select({
                  verdict: judgeCache.verdict,
                  model: judgeCache.model,
                })
                .from(judgeCache)
                .where(cacheCondition);
              return decodeCached(cached);
            },
            write: async ({ verdict, model }) => {
              await tx.insert(judgeCache).values({
                entryId: request.entryId,
                direction: request.direction,
                normalizedAnswer: request.normalizedAnswer,
                verdict,
                model,
              });
            },
          });
        }),
      judge: async () =>
        judgeRuntime.runPromise(
          Effect.gen(function* () {
            const judge = yield* Judge;
            const verdict = yield* judge.judge(request.input);
            return { verdict, model: judge.modelId };
          }),
        ),
    });
  } catch {
    return null;
  }
};
