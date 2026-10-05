import { Schema } from 'effect';

export class AiUsageError extends Schema.TaggedError<AiUsageError>()(
  'AiUsageError',
  { cause: Schema.optional(Schema.Unknown), message: Schema.String },
) {}
