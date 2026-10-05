import { describe, expect, it } from 'bun:test';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { Effect, Layer } from 'effect';
import { DefinitionJudge } from '../definition/judge';
import { DefinitionWriter } from '../definition/writer';
import type { ExtractedPageData } from '../extraction/schema';
import { Extraction } from '../extraction/service';
import type { JudgeVerdictData } from '../judge/schema';
import { Judge } from '../judge/service';
import { SentenceJudge } from '../sentence/judge';
import { SentenceGen } from '../sentence/service';
import { type AiCall, type AiCallUsage, AiUsage } from '../usage';
import { BedrockProvider, productionModelId } from './bedrock';

const modelId = productionModelId;

const capturedServices = (response: unknown) => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const usage: Array<{
    call: AiCall;
    succeeded: boolean;
    usage: AiCallUsage | undefined;
  }> = [];
  const bedrock = createAmazonBedrock({
    // Fake SigV4 credentials keep authentication offline; serialization is real.
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
                content: [{ text: JSON.stringify(response) }],
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
  const services = Layer.mergeAll(
    Judge.layer,
    SentenceGen.layer,
    Extraction.layer,
    DefinitionJudge.layer,
    DefinitionWriter.layer,
    SentenceJudge.layer,
  ).pipe(
    Layer.provide(Layer.succeed(BedrockProvider, bedrock(modelId))),
    Layer.merge(
      Layer.succeed(
        AiUsage,
        AiUsage.of({
          start: (call) =>
            Effect.succeed({
              settle: (outcome) =>
                Effect.sync(() => {
                  usage.push({ call, ...outcome });
                }),
            }),
        }),
      ),
    ),
  );
  return { calls, services, usage };
};

describe('Bedrock workload transport', () => {
  it('sends judge requests with medium reasoning and decodes Unicode output', async () => {
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
    const { calls, services, usage } = capturedServices(verdict);
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
    expect(usage).toEqual([
      {
        call: {
          operation: 'answer-grading',
          provider: 'bedrock',
          model: modelId,
        },
        succeeded: true,
        usage: expect.objectContaining({
          tokens: { input: 10, cachedInput: 0, cacheWrite: 0, output: 20 },
        }),
      },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain(`${modelId}/converse`);
    expect(calls[0]?.body).toHaveProperty(
      'additionalModelRequestFields.output_config.effort',
      'medium',
    );
    expect(calls[0]?.body).toHaveProperty(
      'additionalModelRequestFields.thinking.type',
      'adaptive',
    );
    expect(JSON.stringify(calls[0]?.body.system)).toContain('JSON schema');
    expect(calls[0]?.body).not.toHaveProperty('toolConfig');
    expect(JSON.stringify(calls[0]?.body)).toContain('café');
  });
});

describe('Bedrock sentence transport', () => {
  it('grades sentence translations with the production model and medium reasoning', async () => {
    const verdict = {
      meaningKept: true,
      grammatical: false,
      spelledCorrectly: true,
      wordUsed: true,
      correction: 'Mi hermana trabaja como abogada en Madrid.',
      explanation: "Die Anwältin ist weiblich: 'abogada'.",
    };
    const { calls, services } = capturedServices(verdict);
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const judge = yield* SentenceJudge;
        expect(judge.modelId).toBe(modelId);
        return yield* judge.judge({
          targetLanguage: 'Spanish',
          sentence: 'Meine Schwester arbeitet als Anwältin in Madrid.',
          reference: 'Mi hermana trabaja como abogada en Madrid.',
          word: { target: 'la abogada', german: 'die Anwältin' },
          givenAnswer: 'Mi hermana trabaja como abogado en Madrid.',
        });
      }).pipe(Effect.provide(services)),
    );
    expect(result).toEqual(verdict);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain(`${modelId}/converse`);
    expect(calls[0]?.body).toHaveProperty(
      'additionalModelRequestFields.output_config.effort',
      'medium',
    );
    expect(calls[0]?.body).toHaveProperty(
      'additionalModelRequestFields.thinking.type',
      'adaptive',
    );
    expect(JSON.stringify(calls[0]?.body.system)).toContain('JSON schema');
    expect(calls[0]?.body).not.toHaveProperty('toolConfig');
  });

  it('returns a typed error for a malformed sentence verdict', async () => {
    const { services } = capturedServices({ meaningKept: 'yes' });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* SentenceJudge).judge({
          targetLanguage: 'French',
          sentence: 'Ich lese.',
          reference: 'Je lis.',
          word: { target: 'lire', german: 'lesen' },
          givenAnswer: 'Je suis en train de lire.',
        });
      }).pipe(Effect.provide(services), Effect.result),
    );
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: {
        _tag: 'SentenceJudgeError',
        message: 'The sentence translation could not be graded.',
      },
    });
  });

  it.each(['generate', 'translate', 'translateWord'] as const)(
    'sends %s through the same medium reasoning configuration',
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
      expect(calls[0]?.url).toContain(`${modelId}/converse`);
      expect(calls[0]?.body).toHaveProperty(
        'additionalModelRequestFields.output_config.effort',
        'medium',
      );
      expect(calls[0]?.body).toHaveProperty(
        'additionalModelRequestFields.thinking.type',
        'adaptive',
      );
      expect(JSON.stringify(calls[0]?.body.system)).toContain('JSON schema');
      expect(calls[0]?.body).not.toHaveProperty('toolConfig');
    },
  );
});

describe('Bedrock extraction transport', () => {
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
      expect(calls[0]?.url).toContain(`${modelId}/converse`);
      expect(calls[0]?.body).toHaveProperty(
        'additionalModelRequestFields.output_config.effort',
        'medium',
      );
      expect(calls[0]?.body).toHaveProperty(
        'additionalModelRequestFields.thinking.type',
        'adaptive',
      );
      expect(JSON.stringify(calls[0]?.body.system)).toContain('JSON schema');
      expect(calls[0]?.body).not.toHaveProperty('toolConfig');
      expect(JSON.stringify(calls[0]?.body)).toContain('aW1hZ2U=');
    },
  );
});

describe('Bedrock definition transport', () => {
  it.each(['judge', 'keyPoints', 'suggest'] as const)(
    'sends definition %s with medium reasoning',
    async (operation) => {
      const response = {
        judge: {
          keyPoints: [{ covered: true, note: null }],
          accuracy: { ok: true, note: null },
          explanation: null,
        },
        keyPoints: { keyPoints: ['gibt Elektronen ab'] },
        suggest: { definition: 'Ein Elektronendonator gibt Elektronen ab.' },
      }[operation];
      const { calls, services } = capturedServices(response);
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          if (operation === 'judge') {
            return yield* (yield* DefinitionJudge).judge({
              term: 'Elektronendonator',
              definition: 'Ein Elektronendonator gibt Elektronen ab.',
              keyPoints: ['gibt Elektronen ab'],
              givenAnswer: 'Er gibt Elektronen ab.',
            });
          }
          const writer = yield* DefinitionWriter;
          if (operation === 'keyPoints') {
            return yield* writer.keyPoints({
              term: 'Elektronendonator',
              definition: 'Ein Elektronendonator gibt Elektronen ab.',
            });
          }
          return yield* writer.suggest({
            term: 'Elektronendonator',
            subject: 'Chemie',
          });
        }).pipe(Effect.provide(services)),
      );
      expect(result).toEqual(response);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toContain(`${modelId}/converse`);
      expect(calls[0]?.body).toHaveProperty(
        'additionalModelRequestFields.thinking.type',
        'adaptive',
      );
      expect(calls[0]?.body).toHaveProperty(
        'additionalModelRequestFields.output_config.effort',
        'medium',
      );
      expect(calls[0]?.body).not.toHaveProperty('toolConfig');
    },
  );

  it.each([
    { keyPoints: [] },
    { keyPoints: ['one', 'two', 'three', 'four', 'five'] },
  ])(
    'rejects an out-of-bounds key point list from Bedrock',
    async ({ keyPoints }) => {
      const { services } = capturedServices({ keyPoints });
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          return yield* (yield* DefinitionWriter).keyPoints({
            term: 'Elektronendonator',
            definition: 'Ein Elektronendonator gibt Elektronen ab.',
          });
        }).pipe(Effect.provide(services), Effect.result),
      );
      expect(result).toMatchObject({
        _tag: 'Failure',
        failure: { _tag: 'DefinitionError' },
      });
    },
  );

  it('rejects a verdict that omits a requested key point', async () => {
    const { services } = capturedServices({
      keyPoints: [],
      accuracy: { ok: true, note: null },
      explanation: null,
    });
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* DefinitionJudge).judge({
          term: 'Elektronendonator',
          definition: 'Ein Elektronendonator gibt Elektronen ab.',
          keyPoints: ['gibt Elektronen ab'],
          givenAnswer: 'Er gibt Elektronen ab.',
        });
      }).pipe(Effect.provide(services), Effect.result),
    );
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'DefinitionError' },
    });
  });
});
