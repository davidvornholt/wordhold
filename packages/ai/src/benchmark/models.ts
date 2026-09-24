import { createOpenAI } from '@ai-sdk/openai';
import { Config, Effect, Redacted } from 'effect';
import { VertexProvider } from '../providers/vertex';
import { geminiHighProviderOptions } from '../structured-output';
import type { BenchmarkModel } from './runner';

export const benchmarkModels = Effect.gen(function* () {
  const vertex = yield* VertexProvider;
  const key = Redacted.value(yield* Config.redacted('AWS_BEDROCK_API_KEY'));
  const openaiOptions = {
    openai: {
      strictJsonSchema: true,
      store: false,
      forceReasoning: true,
      reasoningEffort: 'high',
      reasoningSummary: null,
    },
  } as const;
  const models: ReadonlyArray<BenchmarkModel> = [
    {
      name: 'gemini-3.8-flash',
      region: yield* Config.string('GOOGLE_VERTEX_LOCATION'),
      model: vertex('gemini-3.8-flash'),
      providerOptions: geminiHighProviderOptions,
    },
    ...(
      [
        ['openai.gpt-6-luna', 'us-east-1'],
        ['openai.gpt-6-astra', 'us-west-2'],
      ] as const
    ).map(([name, region]) => ({
      name,
      region,
      model: createOpenAI({
        baseURL: `https://bedrock-mantle.${region}.api.aws/openai/v1`,
        apiKey: key,
      }).responses(name),
      providerOptions: openaiOptions,
    })),
  ];
  return models;
}).pipe(Effect.provide(VertexProvider.live));
