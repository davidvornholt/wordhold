import { createOpenAI } from '@ai-sdk/openai';
import { Context, Effect, Layer, Redacted } from 'effect';
import { bedrockApiKey, bedrockRegion } from '../config';

// This client targets AWS Mantle's OpenAI-compatible Responses endpoint.
// Wordhold sends a strict text.format schema, but AWS does not document whether
// Mantle accepts that shape. Live provider verification must prove the path
// before deployment.
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
