import { Schema } from 'effect';

export class SentenceGenError extends Schema.TaggedError<SentenceGenError>()(
  'SentenceGenError',
  { cause: Schema.Unknown },
) {}
