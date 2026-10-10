import { describe, expect, it } from 'bun:test';
import { estimateUsd, type Sample, summarize, tokenCounts } from './metrics';

const sample = (changes: Partial<Sample> = {}): Sample => ({
  model: 'fixture',
  workload: 'judge',
  operation: 'answer-grading',
  repetition: 1,
  elapsedMs: 1000,
  capacityRetries: 0,
  inputTokens: 100,
  cachedInputTokens: 0,
  outputTokens: 200,
  reasoningTokens: 150,
  visibleOutputTokens: 50,
  totalTokens: 300,
  usd: 0.002,
  qualityFailures: [],
  error: null,
  output: {},
  finishReason: 'stop',
  responseModelId: 'fixture',
  ...changes,
});

describe('benchmark accounting', () => {
  it('uses summed elapsed time, not the mean of individual token rates', () => {
    const summary = summarize([sample(), sample({ elapsedMs: 3000 })]);
    expect(summary).toMatchObject({
      medianLatencyMs: 2000,
      outputTokensPerMinute: 6000,
      visibleOutputTokensPerMinute: 1500,
      totalTokensPerMinute: 9000,
      reasoningTokens: 300,
    });
  });

  it('keeps unavailable token accounting unknown and failures in elapsed time', () => {
    const summary = summarize([
      sample(),
      sample({
        elapsedMs: 9000,
        inputTokens: null,
        outputTokens: null,
        reasoningTokens: null,
        visibleOutputTokens: null,
        totalTokens: null,
        usd: null,
        error: 'Provider HTTP 403',
      }),
    ]);
    expect(summary).toMatchObject({ elapsedMs: 10_000, usd: null });
    expect(summary.successes).toBe(1);
    expect(summary.qualityPasses).toBe(1);
    expect(summary.outputTokensPerMinute).toBeNull();
    expect(summary.totalTokensPerMinute).toBeNull();
  });

  it('separates visible output from reasoning without counting reasoning twice', () => {
    const counts = tokenCounts({
      inputTokens: 100,
      inputTokenDetails: {
        noCacheTokens: 80,
        cacheReadTokens: 20,
        cacheWriteTokens: undefined,
      },
      outputTokens: 200,
      outputTokenDetails: { textTokens: 50, reasoningTokens: 150 },
      totalTokens: 300,
    });
    expect(counts).toEqual({
      inputTokens: 100,
      cachedInputTokens: 20,
      outputTokens: 200,
      reasoningTokens: 150,
      visibleOutputTokens: 50,
      totalTokens: 300,
    });
  });

  it('leaves visible output unknown when the provider reports no reasoning count', () => {
    const counts = tokenCounts({
      inputTokens: 100,
      inputTokenDetails: {
        noCacheTokens: 100,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
      outputTokens: 200,
      outputTokenDetails: { textTokens: 200, reasoningTokens: undefined },
      totalTokens: 300,
    });
    expect(counts).toMatchObject({
      reasoningTokens: null,
      visibleOutputTokens: null,
    });
  });

  it('prices billed output including reasoning, and unknown counts as unknown', () => {
    const price = { input: 2, output: 10 };
    expect(estimateUsd(price, { inputTokens: 1000, outputTokens: 500 })).toBe(
      0.007,
    );
    expect(
      estimateUsd(price, { inputTokens: 1000, outputTokens: null }),
    ).toBeNull();
  });

  it('reports the 90th percentile latency and capacity retries', () => {
    const summary = summarize(
      Array.from({ length: 10 }, (_, index) =>
        sample({ elapsedMs: (index + 1) * 1000, capacityRetries: index % 2 }),
      ),
    );
    expect(summary).toMatchObject({ p90LatencyMs: 9000, capacityRetries: 5 });
  });
});
