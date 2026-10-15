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
  type ReasoningEffort,
  sonnetProviderOptions,
} from './providers/bedrock';
import { decodeModelOutput, providerJsonSchema } from './structured-output';
import { UnusableAnswerError } from './unusable-answer-error';
import {
  type AiOperation,
  type AiUsage,
  languageModelUsage,
  metered,
} from './usage';
import { AiUsageError } from './usage-error';

// What the log needs to see why an answer was unusable: the text that did not
// parse, or the schema issue. A rejected answer is explained by the message.
const unusableDetail = (cause: unknown): string => {
  if (NoObjectGeneratedError.isInstance(cause)) {
    return cause.text ?? '';
  }
  return cause instanceof Error ? cause.message : '';
};

// One structured request to the production model, decoded with the Effect
// schema. Bedrock receives the schema only as an instruction, so the answer
// text occasionally misses it; an unusable answer is requested once more, and
// every request is metered. `validate` names why a decoded answer cannot be
// used, such as a skipped item, and returns undefined to accept it. The model
// reasons at medium effort unless the operation asks for more.
export const generateStructured = <A, E>(input: {
  readonly model: LanguageModel;
  readonly operation: AiOperation;
  readonly schema: Schema.Decoder<A>;
  readonly prompt: string | Array<ModelMessage>;
  readonly failure: (cause: unknown) => E;
  readonly validate?: (answer: A) => string | undefined;
  readonly effort?: ReasoningEffort;
}): Effect.Effect<A, E, AiUsage> => {
  const decode = decodeModelOutput(input.schema);
  const unusable = (message: string, cause: unknown) =>
    new UnusableAnswerError({ cause, message });

  const request = metered(
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
              providerOptions: sonnetProviderOptions(input.effort ?? 'medium'),
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
        // A truncated answer would be cut off again, so it is not repeated.
        catch: (error) =>
          NoObjectGeneratedError.isInstance(error) &&
          error.finishReason !== 'length'
            ? unusable('The answer is not a JSON object.', error)
            : input.failure(error),
      }),
  );

  const attempt = request.pipe(
    Effect.flatMap((output) =>
      decode(output).pipe(
        Effect.mapError((cause) =>
          unusable('The answer does not match the schema.', cause),
        ),
      ),
    ),
    Effect.flatMap((answer) => {
      const problem = input.validate?.(answer);
      return problem === undefined
        ? Effect.succeed(answer)
        : Effect.fail(unusable(problem, answer));
    }),
    Effect.tapError((error) =>
      error instanceof UnusableAnswerError
        ? Effect.logWarning(
            `Unusable ${input.operation} answer: ${error.message}`,
            unusableDetail(error.cause),
          )
        : Effect.void,
    ),
  );

  return attempt.pipe(
    Effect.retry({
      times: 1,
      while: (error) => error instanceof UnusableAnswerError,
    }),
    Effect.mapError((error) =>
      error instanceof UnusableAnswerError || error instanceof AiUsageError
        ? input.failure(error)
        : error,
    ),
  );
};
