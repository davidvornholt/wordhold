import { Schema } from 'effect';

export class TtsError extends Schema.TaggedError<TtsError>()('TtsError', {
  cause: Schema.Unknown,
}) {}
