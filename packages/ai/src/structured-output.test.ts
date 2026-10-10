import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import {
  DefinitionSuggestion,
  DefinitionVerdict,
  KeyPointList,
  maximumKeyPoints,
} from './definition/schema';
import { ExtractedPage } from './extraction/schema';
import { JudgeVerdict } from './judge/schema';
import { RelationSuggestions } from './relations/schema';
import { SentenceVerdict } from './sentence/judge-schema';
import { SentenceBatch } from './sentence/service';
import { decodeModelOutput, providerJsonSchema } from './structured-output';

// A schema the AI SDK cannot express as JSON Schema fails only once a model is
// actually called, so every structured-output schema is converted here.
const outputSchemas = [
  ['DefinitionSuggestion', () => providerJsonSchema(DefinitionSuggestion)],
  ['DefinitionVerdict', () => providerJsonSchema(DefinitionVerdict)],
  ['ExtractedPage', () => providerJsonSchema(ExtractedPage)],
  ['KeyPointList', () => providerJsonSchema(KeyPointList)],
  ['JudgeVerdict', () => providerJsonSchema(JudgeVerdict)],
  ['RelationSuggestions', () => providerJsonSchema(RelationSuggestions)],
  ['SentenceBatch', () => providerJsonSchema(SentenceBatch)],
  ['SentenceVerdict', () => providerJsonSchema(SentenceVerdict)],
] as const;

const objectNodes = (root: unknown): ReadonlyArray<Record<string, unknown>> => {
  const pending: Array<unknown> = [root];
  const nodes: Array<Record<string, unknown>> = [];
  while (pending.length > 0) {
    const node = pending.pop();
    if (typeof node === 'object' && node !== null) {
      const record = node as Record<string, unknown>;
      nodes.push(record);
      pending.push(...Object.values(record));
    }
  }
  return nodes;
};

describe('providerJsonSchema', () => {
  for (const [name, convert] of outputSchemas) {
    it(`converts ${name} to a provider-ready JSON Schema`, () => {
      const converted = convert().jsonSchema;

      expect(converted.type).toBe('object');
      expect(Object.keys(converted.properties ?? {}).length).toBeGreaterThan(0);
      // Providers reject cross-references in structured output schemas.
      expect(JSON.stringify(converted)).not.toContain('$ref');
    });
  }

  it('keeps extraction objects closed and confidences bounded', () => {
    const schema = providerJsonSchema(ExtractedPage).jsonSchema;
    expect(schema).toHaveProperty('additionalProperties', false);
    expect(schema).toHaveProperty('properties.overallConfidence', {
      type: 'number',
      minimum: 0,
      maximum: 1,
    });
  });

  it('keeps key point bounds in the schema sent to Bedrock', () => {
    const schema = providerJsonSchema(KeyPointList).jsonSchema;
    expect(schema).toHaveProperty('properties.keyPoints.minItems', 1);
    expect(schema).toHaveProperty(
      'properties.keyPoints.maxItems',
      maximumKeyPoints,
    );
  });

  for (const [name, convert] of [
    ['DefinitionVerdict', () => providerJsonSchema(DefinitionVerdict)],
    ['JudgeVerdict', () => providerJsonSchema(JudgeVerdict)],
    ['RelationSuggestions', () => providerJsonSchema(RelationSuggestions)],
    ['SentenceBatch', () => providerJsonSchema(SentenceBatch)],
    ['SentenceVerdict', () => providerJsonSchema(SentenceVerdict)],
  ] as const) {
    it(`marks every ${name} object property as required`, () => {
      const incompleteObjects = objectNodes(convert().jsonSchema)
        .filter((node) => 'properties' in node)
        .map((node) => ({
          properties: Object.keys(
            (node.properties ?? {}) as Record<string, unknown>,
          ),
          required: new Set(node.required as ReadonlyArray<string> | undefined),
        }))
        .filter(({ properties, required }) =>
          properties.some((property) => !required.has(property)),
        );
      expect(incompleteObjects).toEqual([]);
    });
  }
});

describe('decodeModelOutput', () => {
  // The schema sent to Bedrock allows null for absent optional fields.
  it('reads a null optional field as absent', () => {
    const page = Effect.runSync(
      decodeModelOutput(ExtractedPage)({
        unitName: null,
        overallConfidence: 0.9,
        entries: [
          {
            targetText: 'the book',
            nativeText: 'das Buch',
            grammar: null,
            example: null,
            synonyms: null,
            antonyms: null,
            confidence: 0.9,
          },
        ],
      }),
    );
    expect(page.unitName).toBeUndefined();
    expect(page.entries[0]?.grammar).toBeUndefined();
    expect(page.entries[0]?.synonyms).toBeUndefined();
  });

  it('still rejects an answer outside the schema', () => {
    const result = Effect.runSync(
      Effect.result(
        decodeModelOutput(ExtractedPage)({
          overallConfidence: 2,
          entries: [],
        }),
      ),
    );
    expect(result._tag).toBe('Failure');
  });
});
