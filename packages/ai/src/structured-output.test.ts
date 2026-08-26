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
});
