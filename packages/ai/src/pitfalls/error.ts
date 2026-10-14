import { Schema } from 'effect';

export class SpellingPitfallError extends Schema.TaggedError<SpellingPitfallError>()(
  'SpellingPitfallError',
  { cause: Schema.Unknown, message: Schema.String },
) {}
