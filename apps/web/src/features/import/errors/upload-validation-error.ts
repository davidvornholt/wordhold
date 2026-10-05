import { Schema } from 'effect';

export class UploadValidationError extends Schema.TaggedError<UploadValidationError>()(
  'UploadValidationError',
  { message: Schema.String, status: Schema.Number },
) {}
