import { jsonSchema } from 'ai';
import { JSONSchema, type Schema } from 'effect';

// Bedrock receives the complete schema as a JSON instruction. Decode each
// answer with the Effect schema before returning it to the application.
export const providerJsonSchema = <A, I>(schema: Schema.Schema<A, I>) =>
  jsonSchema<unknown>(JSONSchema.make(schema));
