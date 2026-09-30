import { definitionJudgePrompt } from '@wordhold/ai/definition/judge';
import type {
  DefinitionJudgeInput,
  DefinitionVerdictData,
} from '@wordhold/ai/definition/schema';
import { judgePrompt } from '@wordhold/ai/judge';
import type { JudgeInput, JudgeVerdictData } from '@wordhold/ai/judge/schema';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { Effect } from 'effect';
import type {
  PracticeDatabaseError,
  PracticeJudgeError,
} from '../errors/practice-errors';
import type {
  CachedVerdict,
  JudgeCacheKey,
  StoredVerdict,
} from '../schemas/practice-models';
import { DefinitionGrader } from './definition-grader';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';

// Bind persisted assessments to the actual instructions and task, not just a
// model name. Prompt edits, changed accepted answers and edited key points
// invalidate old verdicts.
const cacheIdentity = async (model: string, prompt: string) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(prompt),
  );
  return `${model}:${new Uint8Array(digest).toHex()}`;
};

export const judgeCacheIdentity = (
  model: string,
  input: JudgeInput,
): Promise<string> => cacheIdentity(model, judgePrompt(input));

export const definitionCacheIdentity = (
  model: string,
  input: DefinitionJudgeInput,
): Promise<string> => cacheIdentity(model, definitionJudgePrompt(input));

export const isTranslationVerdict = (
  verdict: StoredVerdict,
): verdict is JudgeVerdictData => 'correct' in verdict;

export const isDefinitionVerdict = (
  verdict: StoredVerdict,
): verdict is DefinitionVerdictData => 'accuracy' in verdict;

const judgeThroughCache = <V extends StoredVerdict, R>(
  key: JudgeCacheKey,
  model: string,
  matches: (verdict: StoredVerdict) => verdict is V,
  judge: Effect.Effect<V, PracticeJudgeError, R>,
): Effect.Effect<
  CachedVerdict<V>,
  PracticeDatabaseError | PracticeJudgeError,
  JudgeCacheStore | R
> =>
  Effect.gen(function* () {
    const cache = yield* JudgeCacheStore;
    const read = Effect.map(cache.read(key, { model }), (stored) =>
      stored !== undefined && matches(stored.verdict)
        ? {
            assessmentId: stored.assessmentId,
            verdict: stored.verdict,
            model: stored.model,
          }
        : undefined,
    );
    const cached = yield* read;
    if (cached !== undefined) {
      return cached;
    }
    return yield* cache.withCriticalSection(
      key,
      Effect.gen(function* () {
        const rechecked = yield* read;
        if (rechecked !== undefined) {
          return rechecked;
        }
        const judged = {
          verdict: yield* judge,
          model,
          assessmentId: crypto.randomUUID(),
        };
        yield* cache.write(key, judged);
        return judged;
      }),
    );
  });

type JudgeRequest = JudgeCacheKey & {
  readonly direction: AnswerDirection;
  readonly input: JudgeInput;
};

export const judgeWithCache = (request: JudgeRequest) =>
  Effect.gen(function* () {
    const judge = yield* PracticeJudge;
    const model = yield* Effect.promise(() =>
      judgeCacheIdentity(judge.model, request.input),
    );
    return yield* judgeThroughCache(
      request,
      model,
      isTranslationVerdict,
      Effect.map(judge.judge(request.input), ({ verdict }) => verdict),
    );
  });

type DefinitionRequest = JudgeCacheKey & {
  readonly input: DefinitionJudgeInput;
};

export const judgeDefinitionWithCache = (request: DefinitionRequest) =>
  Effect.gen(function* () {
    const grader = yield* DefinitionGrader;
    const model = yield* Effect.promise(() =>
      definitionCacheIdentity(grader.model, request.input),
    );
    return yield* judgeThroughCache(
      request,
      model,
      isDefinitionVerdict,
      grader.judge(request.input),
    );
  });
