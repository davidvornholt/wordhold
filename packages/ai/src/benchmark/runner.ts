import {
  APICallError,
  generateText,
  type LanguageModel,
  NoObjectGeneratedError,
  Output,
} from 'ai';
import { Duration, Effect, Schema } from 'effect';
import type { providerJsonSchema } from '../structured-output';
import {
  estimateUsd,
  type Sample,
  tokenCounts,
  type UsdPerMillionTokens,
} from './metrics';
import type { Workload } from './workload';

export const timeoutMs = 600_000;
// Seconds to wait before each retry of a request the provider turned away
// for capacity. Such a request was not served, so it is not a sample.
// The wait doubles after each refusal.
const firstCapacityBackoffSeconds = 15;
const capacityRetryLimit = 3;
export const capacityBackoffSeconds: ReadonlyArray<number> = Array.from(
  { length: capacityRetryLimit },
  (_, retry) => firstCapacityBackoffSeconds * 2 ** retry,
);
const tooManyRequests = 429;
const serviceUnavailable = 503;
const capacityStatusCodes = new Set([tooManyRequests, serviceUnavailable]);

export type BenchmarkModel = {
  readonly name: string;
  readonly region: string;
  readonly reasoning: string;
  readonly usdPerMillionTokens: UsdPerMillionTokens | null;
  readonly model: LanguageModel;
  readonly providerOptions: NonNullable<
    Parameters<typeof generateText>[0]['providerOptions']
  >;
  // How this provider is shown a workload's Effect schema.
  readonly jsonSchema: (
    schema: Schema.Top,
  ) => ReturnType<typeof providerJsonSchema>;
  // Undefined sends no limit, as production does.
  readonly maxOutputTokens: number | undefined;
};

class BenchmarkRequestError extends Schema.TaggedError<BenchmarkRequestError>()(
  'BenchmarkRequestError',
  { message: Schema.String, cause: Schema.Unknown },
) {}

const safeError = (cause: unknown): string => {
  if (APICallError.isInstance(cause)) {
    return `Provider HTTP ${cause.statusCode ?? 'unknown'}`;
  }
  if (NoObjectGeneratedError.isInstance(cause)) {
    return 'Structured output missing or invalid';
  }
  return 'Request failed; inspect provider access and timeout';
};

const isCapacityError = (cause: unknown): boolean =>
  APICallError.isInstance(cause) &&
  cause.statusCode !== undefined &&
  capacityStatusCodes.has(cause.statusCode);

const unknownTokens = {
  inputTokens: null,
  cachedInputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
  visibleOutputTokens: null,
  totalTokens: null,
} as const;

const completionSample = (
  generated: Pick<
    Awaited<ReturnType<typeof generateText>>,
    'usage' | 'output' | 'finishReason' | 'response' | 'text'
  >,
  workload: Workload,
) =>
  Effect.gen(function* () {
    // The SDK's output getter can throw after a provider response was received.
    // Read it separately so that known usage and completion metadata survive.
    const parsed = yield* Effect.try({
      try: () => generated.output,
      catch: (cause) =>
        new BenchmarkRequestError({ message: safeError(cause), cause }),
    }).pipe(Effect.result);
    const error = parsed._tag === 'Failure' ? parsed.failure.message : null;
    return {
      ...tokenCounts(generated.usage),
      qualityFailures:
        parsed._tag === 'Success'
          ? workload.qualityFailures(parsed.success)
          : [],
      error:
        generated.finishReason === 'length'
          ? 'Output token limit reached'
          : error,
      output: parsed._tag === 'Success' ? parsed.success : generated.text,
      finishReason: generated.finishReason,
      responseModelId: generated.response.modelId,
    };
  });

const failureSample = (failure: BenchmarkRequestError) => {
  const { cause } = failure;
  const generatedError = NoObjectGeneratedError.isInstance(cause)
    ? cause
    : null;
  const usage = generatedError?.usage;
  return {
    ...(usage ? tokenCounts(usage) : unknownTokens),
    qualityFailures: [],
    error:
      generatedError?.finishReason === 'length'
        ? 'Output token limit reached'
        : failure.message,
    output: generatedError?.text ?? null,
    finishReason: generatedError?.finishReason ?? null,
    responseModelId: generatedError?.response?.modelId ?? null,
  };
};

const attempt = (
  model: BenchmarkModel,
  workload: Workload,
  repetition: number,
  capacityRetries: number,
): Effect.Effect<Sample> =>
  Effect.gen(function* () {
    const started = performance.now();
    const result = yield* Effect.tryPromise({
      try: () =>
        generateText({
          model: model.model,
          messages: workload.messages,
          output: Output.object({ schema: model.jsonSchema(workload.schema) }),
          providerOptions: model.providerOptions,
          maxOutputTokens: model.maxOutputTokens,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(timeoutMs),
        }),
      catch: (cause) =>
        new BenchmarkRequestError({ message: safeError(cause), cause }),
    }).pipe(Effect.result);
    const elapsedMs = performance.now() - started;
    const backoff = capacityBackoffSeconds[capacityRetries];
    if (
      result._tag === 'Failure' &&
      isCapacityError(result.failure.cause) &&
      backoff !== undefined
    ) {
      yield* Effect.sleep(Duration.seconds(backoff));
      return yield* attempt(model, workload, repetition, capacityRetries + 1);
    }
    const outcome =
      result._tag === 'Failure'
        ? failureSample(result.failure)
        : yield* completionSample(result.success, workload);
    return {
      model: model.name,
      workload: workload.name,
      operation: workload.operation,
      repetition,
      elapsedMs,
      capacityRetries,
      usd: estimateUsd(model.usdPerMillionTokens, outcome),
      ...outcome,
    };
  });

export const runSample = (
  model: BenchmarkModel,
  workload: Workload,
  repetition: number,
): Effect.Effect<Sample> => attempt(model, workload, repetition, 0);
