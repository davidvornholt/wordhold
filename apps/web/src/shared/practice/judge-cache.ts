import { Judge } from '@wordhold/ai/judge';
import type { JudgeInput, JudgeVerdictData } from '@wordhold/ai/judge/schema';
import type { AnswerDirection } from '@wordhold/db/schema/entries';
import { judgeCache } from '@wordhold/db/schema/practice';
import { and, eq } from 'drizzle-orm';
import { Effect } from 'effect';
import { judgeRuntime } from '../ai/runtime';
import { db } from '../db/server';

type JudgeRequest = {
  readonly entryId: string;
  readonly direction: AnswerDirection;
  readonly normalizedAnswer: string;
  readonly input: JudgeInput;
};

// Verdicts are cached per (entry, direction, normalized answer): repeating
// the same wrong answer never re-bills a model call. Returns null when the
// judge is unreachable — the caller must then leave the card ungraded.
export const judgeWithCache = async (
  request: JudgeRequest,
): Promise<JudgeVerdictData | null> => {
  const [cached] = await db
    .select()
    .from(judgeCache)
    .where(
      and(
        eq(judgeCache.entryId, request.entryId),
        eq(judgeCache.direction, request.direction),
        eq(judgeCache.normalizedAnswer, request.normalizedAnswer),
      ),
    );
  if (cached !== undefined) {
    return cached.verdict as JudgeVerdictData;
  }
  try {
    const { verdict, model } = await judgeRuntime.runPromise(
      Effect.gen(function* () {
        const judge = yield* Judge;
        const result = yield* judge.judge(request.input);
        return { verdict: result, model: judge.modelId };
      }),
    );
    await db
      .insert(judgeCache)
      .values({
        entryId: request.entryId,
        direction: request.direction,
        normalizedAnswer: request.normalizedAnswer,
        verdict,
        model,
      })
      .onConflictDoNothing();
    return verdict;
  } catch {
    return null;
  }
};
