import { jsonSchema } from 'ai';
import { Option, Schema } from 'effect';
import { jsonSchemaOf } from '../structured-output';

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

// The production JSON Schema without array length bounds, for the Gemini and
// OpenAI candidates. Claude candidates receive the production schema as is.
export const compatibleJsonSchema = (schema: Schema.Top) =>
  jsonSchema<unknown>(
    providerCompatibleJsonSchema(jsonSchemaOf(schema)) as ReturnType<
      typeof jsonSchemaOf
    >,
  );

// Answers follow the canonical JSON form the provider was shown, where an
// absent optional field may arrive as null. Quality scoring reads them through
// the same JSON codec as production decoding, so a valid answer is not scored
// as a schema failure. Returns undefined when the answer does not decode.
export const readModelOutput = <A>(schema: Schema.Decoder<A>) => {
  const decode = Schema.decodeUnknownOption(Schema.toCodecJson(schema));
  return (answer: unknown): A | undefined =>
    Option.getOrUndefined(decode(answer));
};

// Vertex forwards this to generationConfig.thinkingConfig for every workload.
export const geminiHighProviderOptions = {
  googleVertex: {
    thinkingConfig: { thinkingLevel: 'high' },
  },
} as const;
