import type { JudgeInput } from '@wordhold/ai/judge/schema';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { Effect } from 'effect';
import type {
  PracticeDatabaseError,
  PracticeJudgeError,
} from '../errors/practice-errors';
import type {
  CachedJudgeVerdict,
  JudgeCacheKey,
} from '../schemas/practice-models';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';

type JudgeRequest = JudgeCacheKey & {
  readonly direction: AnswerDirection;
  readonly input: JudgeInput;
};

export const judgeWithCache = (
  request: JudgeRequest,
): Effect.Effect<
  CachedJudgeVerdict,
  PracticeDatabaseError | PracticeJudgeError,
  JudgeCacheStore | PracticeJudge
> =>
  Effect.gen(function* () {
    const cache = yield* JudgeCacheStore;
    const judge = yield* PracticeJudge;
    const cached = yield* cache.read(request, { model: judge.model });
    if (cached !== undefined) {
      return cached;
    }
    return yield* cache.withCriticalSection(
      request,
      Effect.gen(function* () {
        const rechecked = yield* cache.read(request, { model: judge.model });
        if (rechecked !== undefined) {
          return rechecked;
        }
        const judged = yield* judge.judge(request.input);
        const cachedJudgment = {
          ...judged,
          assessmentId: crypto.randomUUID(),
        };
        yield* cache.write(request, cachedJudgment);
        return cachedJudgment;
      }),
    );
  });
