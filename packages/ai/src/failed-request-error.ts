import { Schema } from 'effect';

// The request failed without an answer, such as on an HTTP error, a timeout
// or a lost connection.
export class FailedRequestError extends Schema.TaggedError<FailedRequestError>()(
  'FailedRequestError',
  { statusCode: Schema.optional(Schema.Number), message: Schema.String },
) {}
