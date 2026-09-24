import { describe, expect, it } from 'bun:test';
import { createVertex } from '@ai-sdk/google-vertex';
import { ConfigProvider, Effect, Layer } from 'effect';
import type { ExtractedPageData } from '../extraction/schema';
import { Extraction } from '../extraction/service';
import type { JudgeVerdictData } from '../judge/schema';
import { Judge } from '../judge/service';
import { SentenceGen } from '../sentence/service';
import { VertexProvider } from './vertex';

const modelId = 'gemini-3.8-flash';
const config = Layer.setConfigProvider(
  ConfigProvider.fromMap(
    new Map([
      ['AI_JUDGE_MODEL', modelId],
      ['AI_SENTENCE_MODEL', modelId],
      ['AI_EXTRACTION_MODEL', modelId],
    ]),
  ),
);

const capturedServices = (response: unknown) => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const vertex = createVertex({
    // Fake express-mode credentials keep authentication offline; requests
    // still pass through the real SDK serializer used by the services.
    apiKey: 'test-key',
    location: 'global',
    project: 'test-project',
    fetch: Object.assign(
      (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(url),
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        });
        return Promise.resolve(
          Response.json({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: JSON.stringify(response) }],
                },
                finishReason: 'STOP',
              },
            ],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
              totalTokenCount: 35,
              thoughtsTokenCount: 5,
            },
          }),
        );
      },
      { preconnect: globalThis.fetch.preconnect },
    ),
  });
  const services = Layer.mergeAll(
    Judge.Default,
    SentenceGen.Default,
    Extraction.Default,
  ).pipe(
    Layer.provide(Layer.succeed(VertexProvider, vertex)),
    Layer.provide(config),
  );
  return { calls, services };
};

describe('Vertex workload transport', () => {
  it('sends judge requests with high thinking and decodes Unicode output', async () => {
    const verdict: JudgeVerdictData = {
      correct: true,
      acceptAsAlternative: true,
      meaning: { ok: true, note: null },
      grammar: { ok: true, note: null },
      idiomaticity: { ok: true, note: null },
      spelling: { ok: true, note: null },
      intendedConstruction: { ok: true, note: null },
      explanation: '„Café“ passt. ☕',
    };
    const { calls, services } = capturedServices(verdict);
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* Judge).judge({
          direction: 'to_target',
          targetLanguage: 'French',
          prompt: 'der Kaffee',
          expectedAnswers: ['le café'],
          givenAnswer: 'café',
        });
      }).pipe(Effect.provide(services)),
    );
    expect(result).toEqual(verdict);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain(`${modelId}:generateContent`);
    expect(calls[0]?.body).toHaveProperty(
      'generationConfig.thinkingConfig.thinkingLevel',
      'high',
    );
    expect(calls[0]?.body).toHaveProperty(
      'generationConfig.responseMimeType',
      'application/json',
    );
    expect(calls[0]?.body).toHaveProperty(
      'generationConfig.responseJsonSchema',
    );
    expect(JSON.stringify(calls[0]?.body)).toContain('café');
  });
});

describe('Vertex sentence transport', () => {
  it.each(['generate', 'translate', 'translateWord'] as const)(
    'sends %s through the same high-thinking configuration',
    async (operation) => {
      const response = {
        generate: { sentences: [{ target: 'Je lis.', native: 'Ich lese.' }] },
        translate: { native: 'Ich lese.' },
        translateWord: { translation: 'le livre' },
      }[operation];
      const { calls, services } = capturedServices(response);
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* SentenceGen;
          if (operation === 'generate') {
            return yield* service.generate({
              targetText: 'lire',
              nativeText: 'lesen',
              targetLanguage: 'French',
              count: 1,
            });
          }
          if (operation === 'translate') {
            return yield* service.translate({
              targetText: 'Je lis.',
              targetLanguage: 'French',
            });
          }
          return yield* service.translateWord({
            text: 'das Buch',
            given: 'native',
            targetLanguage: 'French',
          });
        }).pipe(Effect.provide(services)),
      );
      expect(result).toEqual(response);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toContain(`${modelId}:generateContent`);
      expect(calls[0]?.body).toHaveProperty(
        'generationConfig.thinkingConfig.thinkingLevel',
        'high',
      );
      expect(calls[0]?.body).toHaveProperty(
        'generationConfig.responseMimeType',
        'application/json',
      );
      expect(calls[0]?.body).toHaveProperty(
        'generationConfig.responseJsonSchema',
      );
    },
  );
});

describe('Vertex extraction transport', () => {
  it.each([1, 0])(
    'extracts once at confidence %s without an escalation model',
    async (confidence) => {
      const page: ExtractedPageData = {
        entries:
          confidence === 0
            ? []
            : [{ targetText: 'le livre', nativeText: 'das Buch', confidence }],
        overallConfidence: confidence,
      };
      const { calls, services } = capturedServices(page);
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          return yield* (yield* Extraction).extract({
            imageBase64: 'aW1hZ2U=',
            mediaType: 'image/png',
            targetLanguage: 'French',
          });
        }).pipe(Effect.provide(services)),
      );
      expect(result).toEqual({ page, modelId });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toContain(`${modelId}:generateContent`);
      expect(calls[0]?.body).toHaveProperty(
        'generationConfig.thinkingConfig.thinkingLevel',
        'high',
      );
      expect(calls[0]?.body).toHaveProperty(
        'generationConfig.responseMimeType',
        'application/json',
      );
      expect(calls[0]?.body).toHaveProperty(
        'generationConfig.responseJsonSchema',
      );
      expect(JSON.stringify(calls[0]?.body)).toContain('aW1hZ2U=');
    },
  );
});
