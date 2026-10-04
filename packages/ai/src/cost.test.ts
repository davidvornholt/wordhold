import { describe, expect, it } from 'bun:test';
import { aiPrice, estimateUsd } from './cost';
import { productionModelId } from './providers/bedrock';

const sonnet = aiPrice({ provider: 'bedrock', model: productionModelId });
const polly = aiPrice({ provider: 'polly', model: 'generative' });

describe('aiPrice', () => {
  it('prices the production model and generative speech', () => {
    expect(sonnet).toMatchObject({ unit: 'tokens', input: 2, output: 10 });
    expect(polly).toMatchObject({ unit: 'characters', characters: 30 });
  });

  it('leaves unknown models unpriced', () => {
    expect(aiPrice({ provider: 'polly', model: 'neural' })).toBeUndefined();
    expect(
      aiPrice({ provider: 'bedrock', model: 'anthropic.claude-haiku' }),
    ).toBeUndefined();
  });
});

describe('estimateUsd', () => {
  it('adds input, cached input and output tokens', () => {
    if (sonnet === undefined) {
      throw new Error('The production model has no price.');
    }
    expect(
      estimateUsd(
        {
          tokens: {
            input: 1_000_000,
            cachedInput: 1_000_000,
            cacheWrite: 0,
            output: 100_000,
          },
          raw: null,
        },
        sonnet,
      ),
    ).toBeCloseTo(3.2);
  });

  it('prices speech by characters', () => {
    if (polly === undefined) {
      throw new Error('Generative speech has no price.');
    }
    expect(estimateUsd({ characters: 2000, raw: null }, polly)).toBeCloseTo(
      0.06,
    );
  });

  it('leaves the estimate unknown without the billed figures', () => {
    if (sonnet === undefined || polly === undefined) {
      throw new Error('A price is missing.');
    }
    expect(estimateUsd({ raw: null }, sonnet)).toBeUndefined();
    expect(estimateUsd({ raw: null }, polly)).toBeUndefined();
    expect(
      estimateUsd(
        {
          tokens: { input: 10, cachedInput: 0, cacheWrite: 5, output: 10 },
          raw: null,
        },
        sonnet,
      ),
    ).toBeUndefined();
  });
});
