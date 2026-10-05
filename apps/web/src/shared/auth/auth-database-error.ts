import { Schema } from 'effect';

export class AuthDatabaseError extends Schema.TaggedError<AuthDatabaseError>()(
  'AuthDatabaseError',
  { operation: Schema.String, message: Schema.String, cause: Schema.Unknown },
) {}
