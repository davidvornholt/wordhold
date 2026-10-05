import { jsonSchema } from 'ai';
import { type JsonSchema, Schema } from 'effect';

// One self-contained JSON Schema, with any shared definitions under `$defs`
// where its references point. It describes the schema's canonical JSON form,
// so objects stay closed and absent optional fields may arrive as null.
export const jsonSchemaOf = (schema: Schema.Top): JsonSchema.JsonSchema => {
  const document = Schema.toJsonSchemaDocument(schema, {
    onExcessProperty: 'error',
  });
  return Object.keys(document.definitions).length === 0
    ? document.schema
    : { ...document.schema, $defs: document.definitions };
};

// Bedrock receives the complete schema as a JSON instruction. Decode each
// answer with decodeModelOutput before returning it to the application.
export const providerJsonSchema = (schema: Schema.Top) =>
  jsonSchema<unknown>(jsonSchemaOf(schema));

// Answers follow the canonical JSON form the provider was shown, so they are
// decoded with its JSON codec. That codec turns a null optional field into an
// absent one, which the schema itself would reject.
export const decodeModelOutput = <A>(schema: Schema.Decoder<A>) =>
  Schema.decodeUnknownEffect(Schema.toCodecJson(schema));
