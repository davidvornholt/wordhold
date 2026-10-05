import { Schema } from 'effect';

export class PracticeDatabaseError extends Schema.TaggedError<PracticeDatabaseError>()(
  'PracticeDatabaseError',
  { operation: Schema.String, cause: Schema.Unknown, message: Schema.String },
) {}

export class PracticeJudgeError extends Schema.TaggedError<PracticeJudgeError>()(
  'PracticeJudgeError',
  { cause: Schema.Unknown, message: Schema.String },
) {}

export class StaleAnswerSubmissionError extends Schema.TaggedError<StaleAnswerSubmissionError>()(
  'StaleAnswerSubmissionError',
  { message: Schema.String },
) {}

export class AnswerTooLongError extends Schema.TaggedError<AnswerTooLongError>()(
  'AnswerTooLongError',
  { message: Schema.String },
) {}

export class StaleSentenceError extends Schema.TaggedError<StaleSentenceError>()(
  'StaleSentenceError',
  { message: Schema.String },
) {}
