import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';

export type CachedJudgeVerdict = {
  readonly verdict: JudgeVerdictData;
  readonly model: string;
};

type LockedJudgeCache = {
  readonly read: () => Promise<CachedJudgeVerdict | undefined>;
  readonly write: (result: CachedJudgeVerdict) => Promise<void>;
};

type JudgeCacheDependencies = {
  readonly read: () => Promise<CachedJudgeVerdict | undefined>;
  readonly withCriticalSection: (
    work: (cache: LockedJudgeCache) => Promise<JudgeVerdictData>,
  ) => Promise<JudgeVerdictData>;
  readonly judge: () => Promise<CachedJudgeVerdict>;
};

export const coordinateJudgeCacheMiss = async (
  dependencies: JudgeCacheDependencies,
): Promise<JudgeVerdictData> => {
  const cached = await dependencies.read();
  if (cached !== undefined) {
    return cached.verdict;
  }
  return dependencies.withCriticalSection(async (cache) => {
    const rechecked = await cache.read();
    if (rechecked !== undefined) {
      return rechecked.verdict;
    }
    const judged = await dependencies.judge();
    await cache.write(judged);
    return judged.verdict;
  });
};
