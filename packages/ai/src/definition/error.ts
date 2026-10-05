import { Schema } from 'effect';

export class DefinitionError extends Schema.TaggedError<DefinitionError>()(
  'DefinitionError',
  { cause: Schema.Unknown, message: Schema.String },
) {}
