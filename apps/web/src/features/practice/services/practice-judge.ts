import { Judge } from '@wordhold/ai/judge';
import type { JudgeInput, JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { Context, Effect, Layer } from 'effect';
import { PracticeJudgeError } from '../errors/practice-errors';
import type { JudgeVerdict } from '../schemas/practice-models';

export class PracticeJudge extends Context.Tag('wordhold/PracticeJudge')<
  PracticeJudge,
  {
    readonly model: string;
    readonly judge: (
      input: JudgeInput,
    ) => Effect.Effect<JudgeVerdict, PracticeJudgeError>;
  }
>() {
  static readonly live = Layer.effect(
    PracticeJudge,
    Effect.gen(function* () {
      const judgeService = yield* Judge;
      const model = `bedrock-mantle:${judgeService.modelId}`;
      const judge = (input: JudgeInput) =>
        judgeService.judge(input).pipe(
          Effect.map(
            (verdict: JudgeVerdictData) => ({ verdict, model }) as const,
          ),
          Effect.mapError(
            (cause) =>
              new PracticeJudgeError({
                cause,
                message: 'Der KI-Prüfer ist gerade nicht erreichbar.',
              }),
          ),
        );
      return { judge, model } as const;
    }),
  );
}
