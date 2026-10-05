import { DefinitionJudge } from '@wordhold/ai/definition/judge';
import type {
  DefinitionJudgeInput,
  DefinitionVerdictData,
  KeyPointRequest,
} from '@wordhold/ai/definition/schema';
import { DefinitionWriter } from '@wordhold/ai/definition/writer';
import type { AiUsage } from '@wordhold/ai/usage';
import { Context, Effect, Layer } from 'effect';
import { PracticeJudgeError } from '../errors/practice-errors';

const unavailable = (cause: unknown) =>
  new PracticeJudgeError({
    cause,
    message: 'Der KI-Prüfer ist gerade nicht erreichbar.',
  });

// Grades a typed definition in a terms course. Key points are derived here
// only for a term saved before they could be; the entry form derives them
// when the term is saved.
export class DefinitionGrader extends Context.Service<
  DefinitionGrader,
  {
    readonly model: string;
    readonly judge: (
      input: DefinitionJudgeInput,
    ) => Effect.Effect<DefinitionVerdictData, PracticeJudgeError, AiUsage>;
    readonly keyPoints: (
      request: KeyPointRequest,
    ) => Effect.Effect<ReadonlyArray<string>, PracticeJudgeError, AiUsage>;
  }
>()('wordhold/DefinitionGrader') {
  static readonly live = Layer.effect(
    DefinitionGrader,
    Effect.gen(function* () {
      const definitionJudge = yield* DefinitionJudge;
      const writer = yield* DefinitionWriter;
      return {
        model: `vertex:${definitionJudge.modelId}`,
        judge: (input: DefinitionJudgeInput) =>
          definitionJudge.judge(input).pipe(Effect.mapError(unavailable)),
        keyPoints: (request: KeyPointRequest) =>
          writer.keyPoints(request).pipe(
            Effect.map((list) => list.keyPoints),
            Effect.mapError(unavailable),
          ),
      } as const;
    }),
  );
}
