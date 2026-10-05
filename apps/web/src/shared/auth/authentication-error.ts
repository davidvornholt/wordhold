import { Schema } from 'effect';

export class AuthenticationError extends Schema.TaggedError<AuthenticationError>()(
  'AuthenticationError',
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) },
) {}
