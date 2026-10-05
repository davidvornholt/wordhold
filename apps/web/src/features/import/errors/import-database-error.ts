import { Schema } from 'effect';

export class ImportDatabaseError extends Schema.TaggedError<ImportDatabaseError>()(
  'ImportDatabaseError',
  { operation: Schema.String, cause: Schema.Unknown, message: Schema.String },
) {}
