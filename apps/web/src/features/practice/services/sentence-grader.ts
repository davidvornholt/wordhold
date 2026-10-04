import { SentenceJudge } from '@wordhold/ai/sentence/judge';
import type {
  SentenceJudgeInput,
  SentenceVerdictData,
} from '@wordhold/ai/sentence/judge-schema';
import { Context, Effect, Layer } from 'effect';
import { PracticeJudgeError } from '../errors/practice-errors';

export class SentenceGrader extends Context.Tag('wordhold/SentenceGrader')<
  SentenceGrader,
  {
    readonly judge: (
      input: SentenceJudgeInput,
    ) => Effect.Effect<SentenceVerdictData, PracticeJudgeError>;
  }
>() {
  static readonly live = Layer.effect(
    SentenceGrader,
    Effect.gen(function* () {
      const sentenceJudge = yield* SentenceJudge;
      const judge = (input: SentenceJudgeInput) =>
        sentenceJudge.judge(input).pipe(
          Effect.mapError(
            (cause) =>
              new PracticeJudgeError({
                cause,
                message: 'Der KI-Prüfer ist gerade nicht erreichbar.',
              }),
          ),
        );
      return { judge } as const;
    }),
  );
}
