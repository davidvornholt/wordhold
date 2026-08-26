import { describe, expect, it } from 'bun:test';
import { ExtractedPage } from './extraction/schema';
import { JudgeVerdict } from './judge/schema';
import { SentenceBatch } from './sentence/service';
import { providerJsonSchema } from './structured-output';

// A schema the AI SDK cannot express as JSON Schema fails only once a model is
// actually called, so every structured-output schema is converted here.
const outputSchemas = [
  ['ExtractedPage', () => providerJsonSchema(ExtractedPage)],
  ['JudgeVerdict', () => providerJsonSchema(JudgeVerdict)],
  ['SentenceBatch', () => providerJsonSchema(SentenceBatch)],
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

  for (const [name, convert] of [
    ['JudgeVerdict', () => providerJsonSchema(JudgeVerdict)],
    ['SentenceBatch', () => providerJsonSchema(SentenceBatch)],
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
