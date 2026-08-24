import { generateText, Output } from 'ai';
import { Effect, Schema } from 'effect';
import { sentenceModel } from '../config';
import { BedrockProvider } from '../providers/bedrock';
import { SentenceGenError } from './error';

export const SentenceBatch = Schema.Struct({
  sentences: Schema.Array(
    Schema.Struct({
      target: Schema.String,
      native: Schema.String,
    }),
  ),
});
export type SentenceBatchData = typeof SentenceBatch.Type;

export type SentenceRequest = {
  readonly targetText: string;
  readonly nativeText: string;
  readonly targetLanguage: string;
  readonly count: number;
};

export const sentencePrompt = (request: SentenceRequest): string =>
  [
    `Write ${request.count} short, natural example sentences in`,
    `${request.targetLanguage} for the vocabulary item`,
    `"${request.targetText}" (German: "${request.nativeText}").`,
    'Use everyday school-life contexts a teenage learner knows. Each sentence',
    'must contain the vocabulary item in a natural form. Provide a faithful',
    'German translation as `native` for every sentence.',
  ].join(' ');

export class SentenceGen extends Effect.Service<SentenceGen>()(
  '@wordhold/ai/SentenceGen',
  {
    effect: Effect.gen(function* () {
      const bedrock = yield* BedrockProvider;
      const modelId = yield* sentenceModel;
      const generate = (
        request: SentenceRequest,
      ): Effect.Effect<SentenceBatchData, SentenceGenError> =>
        Effect.tryPromise({
          try: async () => {
            const { output } = await generateText({
              model: bedrock(modelId),
              output: Output.object({
                schema: Schema.standardSchemaV1(SentenceBatch),
              }),
              prompt: sentencePrompt(request),
            });
            return output;
          },
          catch: (cause) => new SentenceGenError({ cause }),
        });
      return { generate } as const;
    }),
  },
) {}
