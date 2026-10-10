import type { LanguageModelUsage } from 'ai';

const millisecondsPerMinute = 60_000;
const tokensPerMillion = 1_000_000;
const tailLatencyFraction = 0.9;

export type UsdPerMillionTokens = {
  readonly input: number;
  readonly output: number;
};

export type Sample = {
  readonly model: string;
  readonly workload: string;
  readonly operation: string;
  readonly repetition: number;
  readonly elapsedMs: number;
  // Requests the provider turned away for capacity before this one ran.
  readonly capacityRetries: number;
  readonly inputTokens: number | null;
  readonly cachedInputTokens: number | null;
  readonly outputTokens: number | null;
  readonly reasoningTokens: number | null;
  readonly visibleOutputTokens: number | null;
  readonly totalTokens: number | null;
  readonly usd: number | null;
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
    // The SDK normalizes providers so that outputTokens includes reasoning.
    // Bedrock Converse reports thinking as output without a reasoning count,
    // so the visible share is only known when reasoning is.
    visibleOutputTokens:
      reasoning === null
        ? null
        : (usage.outputTokenDetails.textTokens ??
          (output === null ? null : output - reasoning)),
    totalTokens: usage.totalTokens ?? null,
  };
};

// Billed output includes reasoning. Unknown when the price or a count is.
export const estimateUsd = (
  price: UsdPerMillionTokens | null,
  tokens: {
    readonly inputTokens: number | null;
    readonly outputTokens: number | null;
  },
): number | null =>
  price === null || tokens.inputTokens === null || tokens.outputTokens === null
    ? null
    : (tokens.inputTokens * price.input + tokens.outputTokens * price.output) /
      tokensPerMillion;

const sumKnown = (values: ReadonlyArray<number | null>): number | null =>
  values.every((value) => value !== null)
    ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;

// Nearest-rank percentile of sorted values.
const percentile = (
  sorted: ReadonlyArray<number>,
  fraction: number,
): number | null =>
  sorted.length === 0
    ? null
    : (sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)] ?? null);

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
    capacityRetries: samples.reduce(
      (sum, sample) => sum + sample.capacityRetries,
      0,
    ),
    elapsedMs,
    medianLatencyMs:
      latencies.length === 0
        ? null
        : ((latencies[Math.floor((latencies.length - 1) / 2)] ?? 0) +
            (latencies[Math.floor(latencies.length / 2)] ?? 0)) /
          2,
    p90LatencyMs: percentile(latencies, tailLatencyFraction),
    inputTokens,
    outputTokens,
    reasoningTokens,
    visibleOutputTokens,
    totalTokens,
    usd: sumKnown(samples.map((sample) => sample.usd)),
    outputTokensPerMinute: perMinute(outputTokens),
    visibleOutputTokensPerMinute: perMinute(visibleOutputTokens),
    totalTokensPerMinute: perMinute(totalTokens),
  };
};
