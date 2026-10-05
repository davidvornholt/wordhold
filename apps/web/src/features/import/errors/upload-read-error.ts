import { Schema } from 'effect';

export class UploadReadError extends Schema.TaggedError<UploadReadError>()(
  'UploadReadError',
  { message: Schema.String, cause: Schema.Unknown },
) {}
