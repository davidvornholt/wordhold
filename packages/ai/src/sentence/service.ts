import { generateText, Output } from 'ai';
import { Effect, Schema } from 'effect';
import { sentenceModel } from '../config';
import { BedrockProvider } from '../providers/bedrock';
import {
  providerJsonSchema,
  structuredOutputOptions,
} from '../structured-output';
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
    // Like the judge rule, this is only a best-effort mitigation. Model output
    // remains untrusted and may ignore the instruction or repeat quotation
    // marks from prompt inputs.
    'Never use double quotes or typographic quotation marks; if a sentence',
    "needs a quotation, use single quotes ('wort').",
  ].join(' ');

export class SentenceGen extends Effect.Service<SentenceGen>()(
  '@wordhold/ai/SentenceGen',
  {
    effect: Effect.gen(function* () {
      const bedrock = yield* BedrockProvider;
      const modelId = yield* sentenceModel;
      const batchOutput = providerJsonSchema(SentenceBatch);
      const decodeBatch = Schema.decodeUnknown(SentenceBatch);

      const generate = (
        request: SentenceRequest,
      ): Effect.Effect<SentenceBatchData, SentenceGenError> =>
        Effect.tryPromise({
          try: async () => {
            const { output } = await generateText({
              model: bedrock.responses(modelId),
              output: Output.object({ schema: batchOutput }),
              prompt: sentencePrompt(request),
              providerOptions: structuredOutputOptions,
            });
            return output;
          },
          catch: (cause) => new SentenceGenError({ cause }),
        }).pipe(
          Effect.flatMap((output) =>
            decodeBatch(output).pipe(
              Effect.mapError((cause) => new SentenceGenError({ cause })),
            ),
          ),
        );
      return { generate } as const;
    }),
  },
) {}
