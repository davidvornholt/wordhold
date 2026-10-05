import { Schema } from 'effect';

export class ImportSessionNotFoundError extends Schema.TaggedError<ImportSessionNotFoundError>()(
  'ImportSessionNotFoundError',
  { message: Schema.String },
) {}
