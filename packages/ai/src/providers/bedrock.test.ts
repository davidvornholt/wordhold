import { describe, expect, it } from 'bun:test';
import { ConfigProvider, Effect, Layer } from 'effect';
import { BedrockProvider } from './bedrock';

const provider = (region: string) =>
  Effect.runSync(
    Effect.provide(
      BedrockProvider,
      BedrockProvider.live.pipe(
        Layer.provide(
          Layer.setConfigProvider(
            ConfigProvider.fromMap(
              new Map([
                ['AWS_REGION', region],
                ['AWS_BEDROCK_API_KEY', 'ABSKtest'],
              ]),
            ),
          ),
        ),
      ),
    ),
  );

type Call = { readonly url: string; readonly headers: Headers };

// The provider builds its own fetch-backed client, so the request itself is
// the only honest place to read off which endpoint and which API the services
// actually reach.
const captureRequest = async (region: string): Promise<Call> => {
  const original = globalThis.fetch;
  let call: Call | null = null;
  // Written as wire JSON rather than an object literal: these are OpenAI's
  // snake_case field names, not names this codebase chooses.
  const chatCompletion = `{
    "id": "x",
    "created": 0,
    "model": "global.openai.gpt-5.6-luna",
    "choices": [
      {
        "index": 0,
        "finish_reason": "stop",
        "message": { "role": "assistant", "content": "ok" }
      }
    ],
    "usage": { "prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2 }
  }`;
  const answer = () =>
    Promise.resolve(
      new Response(chatCompletion, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  globalThis.fetch = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) => {
      call = { url: String(input), headers: new Headers(init?.headers) };
      return answer();
    },
    { preconnect: original.preconnect },
  );
  try {
    await provider(region)
      .chat('global.openai.gpt-5.6-luna')
      .doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
      });
  } finally {
    globalThis.fetch = original;
  }
  if (call === null) {
    throw new Error('the provider made no request');
  }
  return call;
};

describe('BedrockProvider', () => {
  // Judging and sentence generation are only trustworthy because decoding is
  // constrained to the schema, and that is a property of this endpoint rather
  // than of the model. Bedrock's default host would answer too, just without
  // the guarantee, so the URL is worth pinning.
  it('sends chat completions to the OpenAI-compatible endpoint of its region', async () => {
    const call = await captureRequest('eu-central-1');

    expect(call.url).toBe(
      'https://bedrock-runtime.eu-central-1.amazonaws.com/openai/v1/chat/completions',
    );
  });

  it('follows the configured region', async () => {
    const call = await captureRequest('us-east-1');

    expect(call.url).toStartWith(
      'https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1/',
    );
  });

  // This endpoint takes a bearer token. Signing the request the way the rest
  // of the AWS SDK does would be rejected.
  it('authenticates with the Bedrock API key as a bearer token', async () => {
    const call = await captureRequest('eu-central-1');

    expect(call.headers.get('authorization')).toBe('Bearer ABSKtest');
  });
});
