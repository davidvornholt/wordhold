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

// Providers describe structured output as JSON Schema. The AI SDK can derive
// one from a standard schema only when the vendor supports that conversion,
// and Effect's bridge does not, so convert here and decode the model's answer
// with the Effect schema afterwards. The output type stays `unknown`: what a
// model returns is untrusted until decoding validates it.
export const providerJsonSchema = (schema: Schema.Top) =>
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
