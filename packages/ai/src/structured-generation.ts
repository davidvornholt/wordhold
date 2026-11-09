import {
  APICallError,
  type FinishReason,
  generateText,
  type LanguageModel,
  type ModelMessage,
  NoObjectGeneratedError,
  Output,
  RetryError,
} from 'ai';
import { Effect, Schema } from 'effect';
import { FailedRequestError } from './failed-request-error';
import {
  productionModelId,
  type ReasoningEffort,
  sonnetProviderOptions,
} from './providers/anthropic';
import { decodeModelOutput, providerJsonSchema } from './structured-output';
import { UnusableAnswerError } from './unusable-answer-error';
import {
  type AiCallUsage,
  type AiOperation,
  type AiUsage,
  languageModelUsage,
  metered,
} from './usage';
import { AiUsageError } from './usage-error';

// The AI SDK retries rate limits, overload, server errors and lost connections
// twice with backoff and nothing else; the loop below retries only an
// unusable answer, so the two never stack. A request gives up after ten
// minutes, its retries included.
const providerRetries = 2;
const requestTimeoutMs = 600_000;
const unauthorized = 401;
const forbidden = 403;

// The model stopped without a complete answer, such as on a refusal or at the
// output limit. Asking again would most likely end the same way.
export class IncompleteAnswerError extends Schema.TaggedError<IncompleteAnswerError>()(
  'IncompleteAnswerError',
  { finishReason: Schema.String, message: Schema.String },
) {}

const incomplete = (finishReason: FinishReason) =>
  new IncompleteAnswerError({
    finishReason,
    message: `The model stopped with ${finishReason} before a complete answer.`,
  });

type GenerationFailure =
  | UnusableAnswerError
  | IncompleteAnswerError
  | FailedRequestError
  | AiUsageError;

const apiCallError = (error: unknown): APICallError | undefined => {
  if (APICallError.isInstance(error)) {
    return error;
  }
  return RetryError.isInstance(error) &&
    APICallError.isInstance(error.lastError)
    ? error.lastError
    : undefined;
};

// A line for the operator that never contains the request or the answer. A
// rejected key or missing permission needs a configuration change; the AI SDK
// has already retried a failure that can pass.
export const describeFailure = (error: unknown): string => {
  const apiError = apiCallError(error);
  if (apiError === undefined) {
    return error instanceof Error
      ? `The request failed with ${error.name}.`
      : 'The request failed.';
  }
  const status = apiError.statusCode;
  if (status === unauthorized || status === forbidden) {
    return `The Claude API rejected the key or its permissions (HTTP ${status}); check ANTHROPIC_API_KEY.`;
  }
  if (apiError.isRetryable) {
    return `The Claude API still failed after ${providerRetries} retries (${status === undefined ? 'no response' : `HTTP ${status}`}).`;
  }
  return `The Claude API rejected the request (HTTP ${status ?? 'unknown'}).`;
};

const requestFailure = (
  error: unknown,
): IncompleteAnswerError | FailedRequestError =>
  error instanceof IncompleteAnswerError
    ? error
    : new FailedRequestError({
        statusCode: apiCallError(error)?.statusCode,
        message: describeFailure(error),
      });

// One request with the AI SDK's retries. The usage is reported even for an
// answer that cannot be used, because it was generated and billed.
const requestAnswer = async (
  input: {
    readonly model: LanguageModel;
    readonly schema: Schema.Top;
    readonly prompt: string | Array<ModelMessage>;
    readonly effort: ReasoningEffort;
  },
  report: (usage: AiCallUsage) => void,
): Promise<unknown> => {
  try {
    const result = await generateText({
      model: input.model,
      output: Output.object({ schema: providerJsonSchema(input.schema) }),
      prompt: input.prompt,
      providerOptions: sonnetProviderOptions(input.effort),
      maxRetries: providerRetries,
      timeout: requestTimeoutMs,
    });
    report(languageModelUsage(result.totalUsage));
    if (result.finishReason !== 'stop') {
      throw incomplete(result.finishReason);
    }
    return result.output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      if (error.usage !== undefined) {
        report(languageModelUsage(error.usage));
      }
      if (error.finishReason !== 'stop') {
        throw incomplete(error.finishReason ?? 'other');
      }
    }
    throw error;
  }
};

// One structured request to the production model, decoded with the Effect
// schema. Native structured output cannot enforce every bound of the schema,
// so an unusable answer is requested once more, and every request is metered.
// `validate` names why a decoded answer cannot be used, such as a skipped
// item, without quoting it, and returns undefined to accept it. The model
// reasons at medium effort unless the operation asks for more. Callers log
// the errors it returns, so they name what failed, such as the HTTP status or
// the finish reason, and never hold the request, the answer or the provider's
// text.
export const generateStructured = <A, E>(input: {
  readonly model: LanguageModel;
  readonly operation: AiOperation;
  readonly schema: Schema.Decoder<A>;
  readonly prompt: string | Array<ModelMessage>;
  readonly failure: (cause: GenerationFailure) => E;
  readonly validate?: (answer: A) => string | undefined;
  readonly effort?: ReasoningEffort;
}): Effect.Effect<A, E, AiUsage> => {
  const decode = decodeModelOutput(input.schema);
  const unusable = (message: string) => new UnusableAnswerError({ message });

  const request = metered(
    {
      operation: input.operation,
      provider: 'anthropic',
      model: productionModelId,
    },
    (report) =>
      Effect.tryPromise({
        try: () =>
          requestAnswer(
            {
              model: input.model,
              schema: input.schema,
              prompt: input.prompt,
              effort: input.effort ?? 'medium',
            },
            report,
          ),
        catch: (error) => error,
      }).pipe(
        Effect.catch((error): Effect.Effect<never, E | UnusableAnswerError> => {
          if (NoObjectGeneratedError.isInstance(error)) {
            return Effect.fail(unusable('The answer is not a JSON object.'));
          }
          const failure = requestFailure(error);
          return Effect.logWarning(
            `${input.operation} request failed: ${failure.message}`,
          ).pipe(Effect.andThen(Effect.fail(input.failure(failure))));
        }),
      ),
  );

  const attempt = request.pipe(
    Effect.flatMap((output) =>
      decode(output).pipe(
        Effect.mapError(() =>
          unusable('The answer does not match the schema.'),
        ),
      ),
    ),
    Effect.flatMap((answer) => {
      const problem = input.validate?.(answer);
      return problem === undefined
        ? Effect.succeed(answer)
        : Effect.fail(unusable(problem));
    }),
    Effect.tapError((error) =>
      error instanceof UnusableAnswerError
        ? Effect.logWarning(
            `Unusable ${input.operation} answer: ${error.message}`,
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
