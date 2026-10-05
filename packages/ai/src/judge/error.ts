import { Schema } from 'effect';

export class JudgeError extends Schema.TaggedError<JudgeError>()('JudgeError', {
  cause: Schema.Unknown,
}) {}
