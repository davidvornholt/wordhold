import { Schema } from 'effect';

export class AuthorizationError extends Schema.TaggedError<AuthorizationError>()(
  'AuthorizationError',
  { message: Schema.String },
) {}
