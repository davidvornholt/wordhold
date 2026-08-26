import { jsonSchema } from 'ai';
import { JSONSchema, type Schema } from 'effect';

// Providers describe structured output as JSON Schema. The AI SDK can derive
// one from a standard schema only when the vendor supports that conversion,
// and Effect's bridge does not, so convert here and decode the model's answer
// with the Effect schema afterwards. The output type stays `unknown`: what a
// model returns is untrusted until decoding validates it.
export const providerJsonSchema = <A, I>(schema: Schema.Schema<A, I>) =>
  jsonSchema<unknown>(JSONSchema.make(schema));

// Constrained decoding is the entire reason these calls go through the
// OpenAI-compatible endpoint, so it is requested explicitly instead of being
// left to a provider default that could change under us. `medium` is Luna's
// own default reasoning level; the calls here are short grading and sentence
// tasks where the model still has to reason about German grammar.
export const structuredOutputOptions = {
  openai: { strictJsonSchema: true, reasoningEffort: 'medium' },
};
