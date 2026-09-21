import { jsonSchema } from 'ai';
import { JSONSchema, type Schema } from 'effect';

// Gemini receives the schema verbatim as `responseJsonSchema` and rejects
// array length bounds with "Request contains an invalid argument". The bound
// is still enforced when the model's answer is decoded with the Effect
// schema, so the request only loses a hint the model would not honour anyway.
const unsupportedByProviders = new Set(['maxItems', 'minItems']);

export const providerCompatibleJsonSchema = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(providerCompatibleJsonSchema);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !unsupportedByProviders.has(key))
        .map(([key, item]) => [key, providerCompatibleJsonSchema(item)]),
    );
  }
  return value;
};

// Providers describe structured output as JSON Schema. The AI SDK can derive
// one from a standard schema only when the vendor supports that conversion,
// and Effect's bridge does not, so convert here and decode the model's answer
// with the Effect schema afterwards. The output type stays `unknown`: what a
// model returns is untrusted until decoding validates it.
export const providerJsonSchema = <A, I>(schema: Schema.Schema<A, I>) =>
  jsonSchema<unknown>(
    providerCompatibleJsonSchema(JSONSchema.make(schema)) as ReturnType<
      typeof JSONSchema.make
    >,
  );

// These calls are stateless. Disabling response storage preserves that behavior
// on the Responses API.
export const structuredOutputOptions = {
  openai: {
    strictJsonSchema: true,
    store: false,
  },
};
