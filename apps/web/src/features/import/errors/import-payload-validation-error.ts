import { Schema } from 'effect';

export class ImportPayloadValidationError extends Schema.TaggedError<ImportPayloadValidationError>()(
  'ImportPayloadValidationError',
  { message: Schema.String, cause: Schema.Unknown },
) {}
