import { Schema } from 'effect';

export class ExtractionFailedError extends Schema.TaggedError<ExtractionFailedError>()(
  'ExtractionFailedError',
  { message: Schema.String, cause: Schema.Unknown },
) {}
