import { Schema } from 'effect';

export class PasskeyListError extends Schema.TaggedError<PasskeyListError>()(
  'PasskeyListError',
  { cause: Schema.Unknown, message: Schema.String },
) {}
