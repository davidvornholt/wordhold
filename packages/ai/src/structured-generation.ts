import {
  generateText,
  type LanguageModel,
  type ModelMessage,
  NoObjectGeneratedError,
  Output,
} from 'ai';
import { Effect, type Schema } from 'effect';
import {
  productionModelId,
  sonnetMediumProviderOptions,
} from './providers/bedrock';
import { providerJsonSchema } from './structured-output';
import {
  type AiOperation,
  type AiUsage,
  languageModelUsage,
  metered,
} from './usage';
import { AiUsageError } from './usage-error';

// One metered structured request to the production model. The answer is
// returned undecoded; callers decode it with the same Effect schema.
export const generateStructured = <E>(input: {
  readonly model: LanguageModel;
  readonly operation: AiOperation;
  readonly schema: Schema.Top;
  readonly prompt: string | Array<ModelMessage>;
  readonly failure: (cause: unknown) => E;
}): Effect.Effect<unknown, E, AiUsage> =>
  metered(
    {
      operation: input.operation,
      provider: 'bedrock',
      model: productionModelId,
    },
    (report) =>
      Effect.tryPromise({
        try: async () => {
          try {
            const result = await generateText({
              model: input.model,
              output: Output.object({
                schema: providerJsonSchema(input.schema),
              }),
              prompt: input.prompt,
              providerOptions: sonnetMediumProviderOptions,
            });
            report(languageModelUsage(result.totalUsage));
            return result.output;
          } catch (error) {
            // An answer that does not parse was still generated and billed.
            if (
              NoObjectGeneratedError.isInstance(error) &&
              error.usage !== undefined
            ) {
              report(languageModelUsage(error.usage));
            }
            throw error;
          }
        },
        catch: input.failure,
      }),
  ).pipe(
    Effect.mapError((error: E | AiUsageError) =>
      error instanceof AiUsageError ? input.failure(error) : error,
    ),
  );
