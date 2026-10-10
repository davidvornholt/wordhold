import { expect, it } from 'bun:test';
import { createVertex } from '@ai-sdk/google-vertex';
import { Effect, Schema } from 'effect';
import { runSample } from './runner';
import {
  compatibleJsonSchema,
  geminiHighProviderOptions,
} from './structured-output';

it('retains known usage when Vertex exhausts reasoning tokens without visible output', async () => {
  const modelId = 'gemini-3.8-flash';
  const vertex = createVertex({
    apiKey: 'test-key',
    location: 'global',
    project: 'test-project',
    fetch: Object.assign(
      () =>
        Promise.resolve(
          Response.json({
            candidates: [
              {
                content: { role: 'model', parts: [] },
                finishReason: 'MAX_TOKENS',
              },
            ],
            usageMetadata: {
              promptTokenCount: 100,
              candidatesTokenCount: 0,
              thoughtsTokenCount: 4096,
              totalTokenCount: 4196,
            },
            modelVersion: modelId,
          }),
        ),
      { preconnect: globalThis.fetch.preconnect },
    ),
  });
  const sample = await Effect.runPromise(
    runSample(
      {
        name: modelId,
        region: 'global',
        reasoning: 'high',
        usdPerMillionTokens: { input: 1, output: 2 },
        model: vertex(modelId),
        providerOptions: geminiHighProviderOptions,
        jsonSchema: compatibleJsonSchema,
        maxOutputTokens: 4096,
      },
      {
        name: 'truncated',
        operation: 'answer-grading',
        prompt: 'Answer.',
        messages: [{ role: 'user', content: 'Answer.' }],
        schema: Schema.Struct({ answer: Schema.Boolean }),
        qualityFailures: () => [],
      },
      1,
    ),
  );
  expect(sample).toMatchObject({
    inputTokens: 100,
    outputTokens: 4096,
    reasoningTokens: 4096,
    visibleOutputTokens: 0,
    totalTokens: 4196,
    usd: 0.008_292,
    capacityRetries: 0,
    finishReason: 'length',
    responseModelId: modelId,
    error: 'Output token limit reached',
  });
});
