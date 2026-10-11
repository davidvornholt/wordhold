import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { productionModelId } from '../providers/bedrock';

export type CapturedBedrockCall = {
  readonly url: string;
  readonly body: Record<string, unknown>;
};

// The production model with its requests recorded. Each request receives the
// next of `answers` and the last one repeats; a string is sent as raw text,
// anything else as JSON text. Fake SigV4 credentials keep authentication
// offline; serialization is real.
export const capturedBedrockModel = (...answers: ReadonlyArray<unknown>) => {
  const calls: Array<CapturedBedrockCall> = [];
  const answerText = (index: number) => {
    const answer = answers[Math.min(index, answers.length - 1)];
    return typeof answer === 'string' ? answer : JSON.stringify(answer);
  };
  const bedrock = createAmazonBedrock({
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    region: 'eu-central-1',
    fetch: Object.assign(
      (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(url),
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        });
        return Promise.resolve(
          Response.json({
            output: {
              message: {
                role: 'assistant',
                content: [{ text: answerText(calls.length - 1) }],
              },
            },
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            metrics: { latencyMs: 1 },
          }),
        );
      },
      { preconnect: globalThis.fetch.preconnect },
    ),
  });
  return { calls, model: bedrock(productionModelId) };
};
