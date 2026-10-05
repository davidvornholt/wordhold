import { Schema } from 'effect';

export class FileReferenceError extends Schema.TaggedError<FileReferenceError>()(
  'FileReferenceError',
  {
    persistenceError: Schema.Unknown,
    cleanupError: Schema.Unknown,
    message: Schema.String,
  },
) {}
