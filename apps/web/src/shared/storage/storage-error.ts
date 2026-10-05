import { Schema } from 'effect';

export class StorageError extends Schema.TaggedError<StorageError>()(
  'StorageError',
  { operation: Schema.String, cause: Schema.Unknown, message: Schema.String },
) {}
