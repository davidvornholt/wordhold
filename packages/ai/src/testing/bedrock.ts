import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { productionModelId } from '../providers/bedrock';

export type CapturedBedrockCall = {
  readonly url: string;
  readonly body: Record<string, unknown>;
};

// The production model with its requests recorded. Each request receives the
// next of `answers` and the last one repeats; a Response is returned as is, a
// string is sent as raw text, anything else as JSON text. Fake SigV4
// credentials keep authentication offline; serialization is real.
export const capturedBedrockModel = (...answers: ReadonlyArray<unknown>) => {
  const calls: Array<CapturedBedrockCall> = [];
  const answerAt = (index: number) =>
    answers[Math.min(index, answers.length - 1)];
  const answerText = (answer: unknown) =>
    typeof answer === 'string' ? answer : JSON.stringify(answer);
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
        const answer = answerAt(calls.length - 1);
        return Promise.resolve(
          answer instanceof Response
            ? answer.clone()
            : Response.json({
                output: {
                  message: {
                    role: 'assistant',
                    content: [{ text: answerText(answer) }],
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
