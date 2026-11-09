import {
  type AnthropicLanguageModelOptions,
  createAnthropic,
} from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';
import { Context, Effect, Layer, Redacted } from 'effect';
import { anthropicApiKey } from '../config';

export const productionModelId = 'claude-sonnet-5-5';

// How much the production model may reason before it answers.
export type ReasoningEffort = 'medium' | 'high';

export const sonnetProviderOptions = (effort: ReasoningEffort) =>
  ({
    anthropic: { thinking: { type: 'adaptive' }, effort },
  }) satisfies { anthropic: AnthropicLanguageModelOptions };

export class AnthropicProvider extends Context.Service<
  AnthropicProvider,
  LanguageModel
>()('@wordhold/ai/Anthropic') {
  static readonly live = Layer.effect(
    AnthropicProvider,
    Effect.gen(function* () {
      const apiKey = Redacted.value(yield* anthropicApiKey);
      return createAnthropic({ apiKey })(productionModelId);
    }),
  );
}
