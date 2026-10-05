import { Schema } from 'effect';

export class SentenceJudgeError extends Schema.TaggedError<SentenceJudgeError>()(
  'SentenceJudgeError',
  { cause: Schema.Unknown, message: Schema.String },
) {}
