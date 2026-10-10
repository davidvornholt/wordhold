import { Schema } from 'effect';

export class RelationError extends Schema.TaggedError<RelationError>()(
  'RelationError',
  { cause: Schema.Unknown, message: Schema.String },
) {}
