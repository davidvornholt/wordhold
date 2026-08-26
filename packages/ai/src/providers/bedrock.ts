import { createOpenAI } from '@ai-sdk/openai';
import { Context, Effect, Layer, Redacted } from 'effect';
import { awsRegion, bedrockApiKey } from '../config';

// Bedrock offers two doors to the same models, and only one of them makes
// structured output safe. Its native API asks the model to please write JSON
// matching a schema, so nothing stops the model from emitting a character
// that breaks its own JSON — a German quotation pair ended the string early
// and truncated a learner's feedback mid-sentence. Its OpenAI-compatible
// endpoint constrains decoding against the schema instead, so invalid JSON is
// not a reachable output. That door authenticates with a Bedrock API key
// rather than the SigV4 pair Polly still uses.
export class BedrockProvider extends Context.Tag('@wordhold/ai/Bedrock')<
  BedrockProvider,
  ReturnType<typeof createOpenAI>
>() {
  static readonly live = Layer.effect(
    BedrockProvider,
    Effect.gen(function* () {
      const region = yield* awsRegion;
      const apiKey = Redacted.value(yield* bedrockApiKey);
      return createOpenAI({
        baseURL: `https://bedrock-runtime.${region}.amazonaws.com/openai/v1`,
        apiKey,
      });
    }),
  );
}
