import { createAnthropic } from '@ai-sdk/anthropic';
import { Config, Effect, Redacted } from 'effect';
import { anthropicApiKey } from '../config';
import { providerJsonSchema } from '../structured-output';
import type { BenchmarkModel } from './runner';
import {
  compatibleJsonSchema,
  geminiHighProviderOptions,
} from './structured-output';
import { VertexProvider } from './vertex';

const otherProviderMaxOutputTokens = 4096;

// Claude API list prices. Haiku 5.5 prompts stay under the 100,000-token
// threshold of its higher tier.
const claudeCandidates = [
  {
    family: 'sonnet',
    efforts: ['low', 'medium'],
    usdPerMillionTokens: { input: 2, output: 10 },
  },
  {
    family: 'haiku',
    efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    usdPerMillionTokens: { input: 0.1, output: 0.5 },
  },
] as const;

const claudeNames = claudeCandidates.flatMap(({ family, efforts }) =>
  efforts.map((effort) => `claude-${family}-5-5-${effort}`),
);

// The same API, request options and schema as production, except effort.
const claudeModels = Effect.gen(function* () {
  const anthropic = createAnthropic({
    apiKey: Redacted.value(yield* anthropicApiKey),
  });
  return claudeCandidates.flatMap(({ family, efforts, usdPerMillionTokens }) =>
    efforts.map(
      (effort): BenchmarkModel => ({
        name: `claude-${family}-5-5-${effort}`,
        region: 'Claude API',
        reasoning: effort,
        usdPerMillionTokens,
        model: anthropic(`claude-${family}-5-5`),
        providerOptions: {
          anthropic: { thinking: { type: 'adaptive' }, effort },
        },
        jsonSchema: providerJsonSchema,
        maxOutputTokens: undefined,
      }),
    ),
  );
});

const geminiModels = Effect.gen(function* () {
  const vertex = yield* VertexProvider;
  const model: BenchmarkModel = {
    name: 'gemini-3.8-flash',
    region: yield* Config.String('GOOGLE_VERTEX_LOCATION'),
    reasoning: 'high',
    // Vertex introductory price through 2026-12-31.
    usdPerMillionTokens: { input: 0.75, output: 3.75 },
    model: vertex('gemini-3.8-flash'),
    providerOptions: geminiHighProviderOptions,
    jsonSchema: compatibleJsonSchema,
    maxOutputTokens: otherProviderMaxOutputTokens,
  };
  return [model];
}).pipe(Effect.provide(VertexProvider.live));

// Each provider is built only when one of its candidates is selected, so a
// run needs credentials for the selected providers alone.
const providers: ReadonlyArray<{
  readonly names: ReadonlyArray<string>;
  readonly models: Effect.Effect<
    ReadonlyArray<BenchmarkModel>,
    Effect.Error<typeof claudeModels> | Effect.Error<typeof geminiModels>
  >;
}> = [
  { names: claudeNames, models: claudeModels },
  { names: ['gemini-3.8-flash'], models: geminiModels },
];

export const candidateNames: ReadonlyArray<string> = providers.flatMap(
  ({ names }) => names,
);

export const benchmarkModels = (selected: ReadonlyArray<string>) =>
  Effect.forEach(
    providers.filter(({ names }) =>
      names.some((name) => selected.includes(name)),
    ),
    ({ models }) => models,
  ).pipe(
    Effect.map((groups) =>
      groups.flat().filter(({ name }) => selected.includes(name)),
    ),
  );
