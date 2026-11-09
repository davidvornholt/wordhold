import { createAnthropic } from '@ai-sdk/anthropic';
import { productionModelId } from '../providers/anthropic';

export type CapturedAnthropicCall = {
  readonly url: string;
  readonly headers: Headers;
  readonly body: Record<string, unknown>;
};

// A Messages API answer whose text and stop reason a test chooses.
export const anthropicMessage = (
  text: string,
  stopReason: 'end_turn' | 'max_tokens' | 'refusal' = 'end_turn',
): Response =>
  Response.json({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: productionModelId,
    content: text === '' ? [] : [{ type: 'text', text }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: 10,
      output_tokens: 20,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  });

// A Claude API error response, shaped as the API sends it. It asks for an
// immediate retry, so a test of the AI SDK's retries does not wait.
export const anthropicError = (
  status: number,
  type: string,
  message = `Test ${type}`,
): Response =>
  Response.json(
    { type: 'error', error: { type, message } },
    { status, headers: { 'retry-after-ms': '0' } },
  );

// A connection that drops before any answer arrives.
export const connectionReset = (): Error =>
  Object.assign(new Error('Test connection reset'), { code: 'ECONNRESET' });

// The production model with its requests recorded. Each request receives the
// next of `answers` and the last one repeats; a Response is returned as is, an
// Error rejects the request, a string is sent as the answer text, anything
// else as JSON text.
export const capturedAnthropicModel = (...answers: ReadonlyArray<unknown>) => {
  const calls: Array<CapturedAnthropicCall> = [];
  const answerAt = (index: number) =>
    answers[Math.min(index, answers.length - 1)];
  const answerText = (answer: unknown) =>
    typeof answer === 'string' ? answer : JSON.stringify(answer);
  const anthropic = createAnthropic({
    apiKey: 'test-anthropic-key',
    fetch: Object.assign(
      (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(url),
          headers: new Headers(init?.headers),
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        });
        const answer = answerAt(calls.length - 1);
        if (answer instanceof Error) {
          return Promise.reject(answer);
        }
        return Promise.resolve(
          answer instanceof Response
            ? answer.clone()
            : anthropicMessage(answerText(answer)),
        );
      },
      { preconnect: globalThis.fetch.preconnect },
    ),
  });
  return { calls, model: anthropic(productionModelId) };
};
