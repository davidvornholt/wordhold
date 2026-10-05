import { Schema } from 'effect';

export class ImportInvariantError extends Schema.TaggedError<ImportInvariantError>()(
  'ImportInvariantError',
  { message: Schema.String },
) {}
