import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { Context, Effect, Layer, Redacted } from 'effect';
import { awsAccessKeyId, awsRegion, awsSecretAccessKey } from '../config';

export class BedrockProvider extends Context.Tag('@wordhold/ai/Bedrock')<
  BedrockProvider,
  ReturnType<typeof createAmazonBedrock>
>() {
  static readonly live = Layer.effect(
    BedrockProvider,
    Effect.gen(function* () {
      const region = yield* awsRegion;
      const accessKeyId = Redacted.value(yield* awsAccessKeyId);
      const secretAccessKey = Redacted.value(yield* awsSecretAccessKey);
      return createAmazonBedrock({ region, accessKeyId, secretAccessKey });
    }),
  );
}
