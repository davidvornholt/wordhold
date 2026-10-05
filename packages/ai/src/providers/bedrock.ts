import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import type { LanguageModel } from 'ai';
import { Context, Effect, Layer, Redacted } from 'effect';
import { awsAccessKeyId, awsRegion, awsSecretAccessKey } from '../config';

export const productionModelId = 'global.anthropic.claude-sonnet-5-5';
export const sonnetMediumProviderOptions = {
  bedrock: {
    reasoningConfig: { type: 'adaptive', maxReasoningEffort: 'medium' },
  },
} as const;

export class BedrockProvider extends Context.Service<
  BedrockProvider,
  LanguageModel
>()('@wordhold/ai/Bedrock') {
  static readonly live = Layer.effect(
    BedrockProvider,
    Effect.gen(function* () {
      const region = yield* awsRegion;
      const accessKeyId = Redacted.value(yield* awsAccessKeyId);
      const secretAccessKey = Redacted.value(yield* awsSecretAccessKey);
      return createAmazonBedrock({ region, accessKeyId, secretAccessKey })(
        productionModelId,
      );
    }),
  );
}
