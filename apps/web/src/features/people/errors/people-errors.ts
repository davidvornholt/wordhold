import { Schema } from 'effect';

export class PeopleDatabaseError extends Schema.TaggedError<PeopleDatabaseError>()(
  'PeopleDatabaseError',
  { operation: Schema.String, cause: Schema.Unknown, message: Schema.String },
) {}

// The person was deleted in the meantime, or the request named the
// administrator, whose access cannot be changed here.
export class PersonNotFoundError extends Schema.TaggedError<PersonNotFoundError>()(
  'PersonNotFoundError',
  { message: Schema.String },
) {}

export class PersonSuspendedError extends Schema.TaggedError<PersonSuspendedError>()(
  'PersonSuspendedError',
  { message: Schema.String },
) {}
