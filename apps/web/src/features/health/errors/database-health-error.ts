import { Schema } from 'effect';

export class DatabaseHealthError extends Schema.TaggedError<DatabaseHealthError>()(
  'DatabaseHealthError',
  { message: Schema.String },
) {}
