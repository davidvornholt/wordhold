import { Schema } from 'effect';

export class SampleDataError extends Schema.TaggedError<SampleDataError>()(
  'SampleDataError',
  { cause: Schema.Unknown, message: Schema.String },
) {}
