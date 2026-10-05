import {
  APICallError,
  generateText,
  type LanguageModel,
  NoObjectGeneratedError,
  Output,
} from 'ai';
import { Effect, Schema } from 'effect';
import { type Sample, tokenCounts } from './metrics';
import type { Workload } from './workloads';

export const maxOutputTokens = 4096;
export const timeoutMs = 240_000;

export type BenchmarkModel = {
  readonly name: string;
  readonly region: string;
  readonly model: LanguageModel;
  readonly providerOptions: NonNullable<
    Parameters<typeof generateText>[0]['providerOptions']
  >;
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

export const runSample = (
  model: BenchmarkModel,
  workload: Workload,
  repetition: number,
): Effect.Effect<Sample> =>
  Effect.gen(function* () {
    const started = performance.now();
    const result = yield* Effect.tryPromise({
      try: () =>
        generateText({
          model: model.model,
          messages: workload.messages,
          output: Output.object({ schema: workload.schema }),
          providerOptions: model.providerOptions,
          maxOutputTokens,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(timeoutMs),
        }),
      catch: (cause) =>
        new BenchmarkRequestError({ message: safeError(cause), cause }),
    }).pipe(Effect.result);
    const elapsedMs = performance.now() - started;
    const base = {
      model: model.name,
      workload: workload.name,
      repetition,
      elapsedMs,
    };
    if (result._tag === 'Failure') {
      const { cause } = result.failure;
      const generatedError = NoObjectGeneratedError.isInstance(cause)
        ? cause
        : null;
      const usage = generatedError?.usage;
      return {
        ...base,
        ...(usage
          ? tokenCounts(usage)
          : {
              inputTokens: null,
              cachedInputTokens: null,
              outputTokens: null,
              reasoningTokens: null,
              visibleOutputTokens: null,
              totalTokens: null,
            }),
        qualityFailures: [],
        error:
          generatedError?.finishReason === 'length'
            ? 'Output token limit reached'
            : result.failure.message,
        output: generatedError?.text ?? null,
        finishReason: generatedError?.finishReason ?? null,
        responseModelId: generatedError?.response?.modelId ?? null,
      };
    }
    return { ...base, ...(yield* completionSample(result.success, workload)) };
  });
