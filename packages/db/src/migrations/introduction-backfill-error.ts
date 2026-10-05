import { Schema } from 'effect';

export class IntroductionBackfillError extends Schema.TaggedError<IntroductionBackfillError>()(
  'IntroductionBackfillError',
  {
    operation: Schema.String,
    cause: Schema.Unknown,
    message: Schema.String,
  },
) {}
