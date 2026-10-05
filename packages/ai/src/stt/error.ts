import { Schema } from 'effect';

export class SttError extends Schema.TaggedError<SttError>()('SttError', {
  message: Schema.String,
  cause: Schema.Unknown,
}) {}
