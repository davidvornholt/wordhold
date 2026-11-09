import { Schema } from 'effect';

// The model answered, but the answer cannot be used: its text is not JSON, it
// does not match the schema, or the caller rejects it. The message names the
// problem without quoting the answer.
export class UnusableAnswerError extends Schema.TaggedError<UnusableAnswerError>()(
  'UnusableAnswerError',
  { message: Schema.String },
) {}
