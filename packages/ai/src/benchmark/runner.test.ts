import { expect, it } from 'bun:test';
import { createVertex } from '@ai-sdk/google-vertex';
import { Effect, Schema } from 'effect';
import {
  geminiHighProviderOptions,
  providerJsonSchema,
} from '../structured-output';
import { runSample } from './runner';

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
        model: vertex(modelId),
        providerOptions: geminiHighProviderOptions,
      },
      {
        name: 'truncated',
        prompt: 'Answer.',
        messages: [{ role: 'user', content: 'Answer.' }],
        schema: providerJsonSchema(Schema.Struct({ answer: Schema.Boolean })),
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
    finishReason: 'length',
    responseModelId: modelId,
    error: 'Output token limit reached',
  });
});
