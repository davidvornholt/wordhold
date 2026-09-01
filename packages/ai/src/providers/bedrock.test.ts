import { describe, expect, it } from 'bun:test';
import { generateText, Output } from 'ai';
import { ConfigProvider, Effect, Layer, type Schema } from 'effect';
import { JudgeVerdict, type JudgeVerdictData } from '../judge/schema';
import {
  SentenceBatch,
  type SentenceBatchData,
  sentenceGenerationProviderOptions,
} from '../sentence/service';
import {
  providerJsonSchema,
  structuredOutputOptions,
} from '../structured-output';
import { BedrockProvider } from './bedrock';

const modelId = 'openai.gpt-5.6-luna';

const provider = (region: string) =>
  Effect.runSync(
    Effect.provide(
      BedrockProvider,
      BedrockProvider.live.pipe(
        Layer.provide(
          Layer.setConfigProvider(
            ConfigProvider.fromMap(
              new Map([
                ['AWS_BEDROCK_REGION', region],
                ['AWS_BEDROCK_API_KEY', 'ABSKtest'],
              ]),
            ),
          ),
        ),
      ),
    ),
  );

type Call = {
  readonly body: Record<string, unknown>;
  readonly headers: Headers;
  readonly url: string;
};

const responseBody = (output: unknown): unknown =>
  JSON.parse(`{
    "id": "response-test",
    "object": "response",
    "created_at": 0,
    "model": "${modelId}",
    "output": [{
      "id": "message-test",
      "type": "message",
      "status": "completed",
      "role": "assistant",
      "content": [{
        "type": "output_text",
        "text": ${JSON.stringify(JSON.stringify(output))},
        "annotations": []
      }]
    }],
    "status": "completed",
    "usage": {
      "input_tokens": 1,
      "input_tokens_details": { "cached_tokens": 0 },
      "output_tokens": 1,
      "output_tokens_details": { "reasoning_tokens": 0 },
      "total_tokens": 2
    }
  }`);

const captureStructuredRequest = async <A, I>(options: {
  readonly output: A;
  readonly prompt: string;
  readonly sentenceGeneration?: boolean;
  readonly region: string;
  readonly schema: Schema.Schema<A, I>;
}): Promise<{
  readonly call: Call;
  readonly output: unknown;
  readonly warnings: ReadonlyArray<unknown>;
}> => {
  const original = globalThis.fetch;
  let call: Call | null = null;
  globalThis.fetch = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) => {
      call = {
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        headers: new Headers(init?.headers),
        url: String(input),
      };
      return Promise.resolve(
        Response.json(responseBody(options.output), { status: 200 }),
      );
    },
    { preconnect: original.preconnect },
  );
  try {
    const result = await generateText({
      model: provider(options.region).responses(modelId),
      output: Output.object({ schema: providerJsonSchema(options.schema) }),
      prompt: options.prompt,
      providerOptions: options.sentenceGeneration
        ? sentenceGenerationProviderOptions
        : structuredOutputOptions,
    });
    if (call === null) {
      throw new Error('the provider made no request');
    }
    return { call, output: result.output, warnings: result.warnings ?? [] };
  } finally {
    globalThis.fetch = original;
  }
};

describe('BedrockProvider', () => {
  it('sends strict judge output through the Mantle Responses API', async () => {
    const verdict: JudgeVerdictData = {
      correct: false,
      acceptAsAlternative: false,
      meaning: { ok: true, note: null },
      grammar: { ok: true, note: null },
      idiomaticity: { ok: false, note: '„Café“ bleibt französisch. ☕' },
      spelling: { ok: true, note: null },
      intendedConstruction: { ok: true, note: null },
      explanation: 'Die Antwort „déjà vu“ ist verständlich, aber unpassend. 🧭',
    };
    const { call, output } = await captureStructuredRequest({
      output: verdict,
      prompt:
        'Bewerte: Er schrieb „Café \\"München\\"“ und setzte 🧭 dahinter.',
      region: 'us-east-1',
      schema: JudgeVerdict,
    });

    expect(call.url).toBe(
      'https://bedrock-mantle.us-east-1.api.aws/openai/v1/responses',
    );
    expect(call.headers.get('authorization')).toBe('Bearer ABSKtest');
    expect(call.body.model).toBe(modelId);
    expect(call.body.store).toBe(false);
    expect(call.body).toHaveProperty('text.format.type', 'json_schema');
    expect(call.body).toHaveProperty('text.format.strict', true);
    expect(JSON.stringify(call.body.input)).toContain('München');
    expect(output).toEqual(verdict);
  });

  it('sends strict sentence output with adversarial Unicode intact', async () => {
    const batch: SentenceBatchData = {
      sentences: [
        {
          target: 'Sie sagte: „Café \\"München\\" ☕“.',
          native: 'She said, “Café \\"Munich\\" ☕.”',
        },
      ],
    };
    const { call, output, warnings } = await captureStructuredRequest({
      output: batch,
      prompt: 'Use „Café \\"München\\" ☕“ exactly, including Unicode.',
      sentenceGeneration: true,
      region: 'us-west-2',
      schema: SentenceBatch,
    });

    expect(call.url).toStartWith(
      'https://bedrock-mantle.us-west-2.api.aws/openai/v1/',
    );
    expect(call.body).toHaveProperty('text.format.type', 'json_schema');
    expect(call.body).toHaveProperty('reasoning.effort', 'medium');
    expect(call.body).not.toHaveProperty('reasoning.summary');
    expect(JSON.stringify(call.body.input)).toContain('Café');
    expect(JSON.stringify(call.body.input)).toContain('☕');
    expect(warnings).toEqual([]);
    expect(output).toEqual(batch);
  });
});
