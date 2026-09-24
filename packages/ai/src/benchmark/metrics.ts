import type { LanguageModelUsage } from 'ai';

const millisecondsPerMinute = 60_000;

export type Sample = {
  readonly model: string;
  readonly workload: string;
  readonly repetition: number;
  readonly elapsedMs: number;
  readonly inputTokens: number | null;
  readonly cachedInputTokens: number | null;
  readonly outputTokens: number | null;
  readonly reasoningTokens: number | null;
  readonly visibleOutputTokens: number | null;
  readonly totalTokens: number | null;
  readonly qualityFailures: ReadonlyArray<string>;
  readonly error: string | null;
  readonly output: unknown;
  readonly finishReason: string | null;
  readonly responseModelId: string | null;
};

export const tokenCounts = (usage: LanguageModelUsage) => {
  const output = usage.outputTokens ?? null;
  const reasoning = usage.outputTokenDetails.reasoningTokens ?? null;
  return {
    inputTokens: usage.inputTokens ?? null,
    cachedInputTokens: usage.inputTokenDetails.cacheReadTokens ?? null,
    outputTokens: output,
    reasoningTokens: reasoning,
    // The SDK normalizes both providers: outputTokens includes reasoning.
    visibleOutputTokens:
      usage.outputTokenDetails.textTokens ??
      (output !== null && reasoning !== null ? output - reasoning : null),
    totalTokens: usage.totalTokens ?? null,
  };
};

const sumKnown = (values: ReadonlyArray<number | null>): number | null =>
  values.every((value) => value !== null)
    ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;

export const summarize = (samples: ReadonlyArray<Sample>) => {
  const elapsedMs = samples.reduce((sum, sample) => sum + sample.elapsedMs, 0);
  const perMinute = (tokens: number | null): number | null =>
    tokens === null || elapsedMs === 0
      ? null
      : (tokens * millisecondsPerMinute) / elapsedMs;
  const inputTokens = sumKnown(samples.map((sample) => sample.inputTokens));
  const outputTokens = sumKnown(samples.map((sample) => sample.outputTokens));
  const reasoningTokens = sumKnown(
    samples.map((sample) => sample.reasoningTokens),
  );
  const visibleOutputTokens = sumKnown(
    samples.map((sample) => sample.visibleOutputTokens),
  );
  const totalTokens = sumKnown(samples.map((sample) => sample.totalTokens));
  const latencies = samples
    .map((sample) => sample.elapsedMs)
    .toSorted((a, b) => a - b);
  return {
    requests: samples.length,
    successes: samples.filter((sample) => sample.error === null).length,
    qualityPasses: samples.filter(
      (sample) => sample.error === null && sample.qualityFailures.length === 0,
    ).length,
    elapsedMs,
    medianLatencyMs:
      latencies.length === 0
        ? null
        : ((latencies[Math.floor((latencies.length - 1) / 2)] ?? 0) +
            (latencies[Math.floor(latencies.length / 2)] ?? 0)) /
          2,
    inputTokens,
    outputTokens,
    reasoningTokens,
    visibleOutputTokens,
    totalTokens,
    outputTokensPerMinute: perMinute(outputTokens),
    visibleOutputTokensPerMinute: perMinute(visibleOutputTokens),
    totalTokensPerMinute: perMinute(totalTokens),
  };
};
