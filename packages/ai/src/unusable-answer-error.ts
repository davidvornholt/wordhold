import { Schema } from 'effect';

// The model answered, but the answer cannot be used: its text is not JSON, it
// does not match the schema, or the caller rejects it.
export class UnusableAnswerError extends Schema.TaggedError<UnusableAnswerError>()(
  'UnusableAnswerError',
  { cause: Schema.Unknown, message: Schema.String },
) {}
