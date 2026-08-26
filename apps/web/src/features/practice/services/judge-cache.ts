import type { JudgeInput, JudgeVerdictData } from '@wordhold/ai/judge/schema';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { Effect } from 'effect';
import type {
  PracticeDatabaseError,
  PracticeJudgeError,
} from '../errors/practice-errors';
import type { JudgeCacheKey } from '../schemas/practice-models';
import { JudgeCacheStore } from './judge-cache-store';
import { PracticeJudge } from './practice-judge';

type JudgeRequest = JudgeCacheKey & {
  readonly direction: AnswerDirection;
  readonly input: JudgeInput;
};

export const judgeWithCache = (
  request: JudgeRequest,
): Effect.Effect<
  JudgeVerdictData,
  PracticeDatabaseError | PracticeJudgeError,
  JudgeCacheStore | PracticeJudge
> =>
  Effect.gen(function* () {
    const cache = yield* JudgeCacheStore;
    const judge = yield* PracticeJudge;
    const cached = yield* cache.read(request);
    if (cached !== undefined) {
      return cached.verdict;
    }
    return yield* cache.withCriticalSection(
      request,
      Effect.gen(function* () {
        const rechecked = yield* cache.read(request);
        if (rechecked !== undefined) {
          return rechecked.verdict;
        }
        const judged = yield* judge.judge(request.input);
        yield* cache.write(request, judged);
        return judged.verdict;
      }),
    );
  });
