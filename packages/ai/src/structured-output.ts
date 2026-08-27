import { jsonSchema } from 'ai';
import { JSONSchema, type Schema } from 'effect';

// Providers describe structured output as JSON Schema. The AI SDK can derive
// one from a standard schema only when the vendor supports that conversion,
// and Effect's bridge does not, so convert here and decode the model's answer
// with the Effect schema afterwards. The output type stays `unknown`: what a
// model returns is untrusted until decoding validates it.
export const providerJsonSchema = <A, I>(schema: Schema.Schema<A, I>) =>
  jsonSchema<unknown>(JSONSchema.make(schema));

// These calls are stateless. Disabling response storage preserves that behavior
// on the Responses API.
export const structuredOutputOptions = {
  openai: {
    strictJsonSchema: true,
    store: false,
  },
};
