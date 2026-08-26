import { createOpenAI } from '@ai-sdk/openai';
import { Context, Effect, Layer, Redacted } from 'effect';
import { bedrockApiKey, bedrockRegion } from '../config';

// AWS documents Structured Outputs for GPT-5.6 Luna only through the Mantle
// Responses API. The runtime endpoint accepts Luna requests but does not
// constrain their output to the supplied schema.
export class BedrockProvider extends Context.Tag('@wordhold/ai/Bedrock')<
  BedrockProvider,
  ReturnType<typeof createOpenAI>
>() {
  static readonly live = Layer.effect(
    BedrockProvider,
    Effect.gen(function* () {
      const region = yield* bedrockRegion;
      const apiKey = Redacted.value(yield* bedrockApiKey);
      return createOpenAI({
        baseURL: `https://bedrock-mantle.${region}.api.aws/openai/v1`,
        apiKey,
      });
    }),
  );
}
