import {
  APICallError,
  generateText,
  type LanguageModel,
  NoObjectGeneratedError,
  Output,
} from 'ai';
import { Data, Effect } from 'effect';
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

class BenchmarkRequestError extends Data.TaggedError('BenchmarkRequestError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

const safeError = (cause: unknown): string => {
  if (APICallError.isInstance(cause)) {
    return `Provider HTTP ${cause.statusCode ?? 'unknown'}`;
  }
  if (NoObjectGeneratedError.isInstance(cause)) {
    return 'Structured output missing or invalid';
  }
  return 'Request failed; inspect provider access and timeout';
};

export const runSample = (
  model: BenchmarkModel,
  workload: Workload,
  repetition: number,
): Effect.Effect<Sample> =>
  Effect.gen(function* () {
    const started = performance.now();
    const result = yield* Effect.tryPromise({
      try: async () => {
        const generated = await generateText({
          model: model.model,
          messages: workload.messages,
          output: Output.object({ schema: workload.schema }),
          providerOptions: model.providerOptions,
          maxOutputTokens,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(timeoutMs),
        });
        return {
          usage: generated.usage,
          output: generated.output,
          finishReason: generated.finishReason,
          response: generated.response,
        };
      },
      catch: (cause) =>
        new BenchmarkRequestError({ message: safeError(cause), cause }),
    }).pipe(Effect.either);
    const elapsedMs = performance.now() - started;
    const base = {
      model: model.name,
      workload: workload.name,
      repetition,
      elapsedMs,
    };
    if (result._tag === 'Left') {
      const { cause } = result.left;
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
        error: result.left.message,
        output: generatedError?.text ?? null,
        finishReason: generatedError?.finishReason ?? null,
        responseModelId: generatedError?.response?.modelId ?? null,
      };
    }
    return {
      ...base,
      ...tokenCounts(result.right.usage),
      qualityFailures: workload.qualityFailures(result.right.output),
      error:
        result.right.finishReason === 'length'
          ? 'Output token limit reached'
          : null,
      output: result.right.output,
      finishReason: result.right.finishReason,
      responseModelId: result.right.response.modelId,
    };
  });
