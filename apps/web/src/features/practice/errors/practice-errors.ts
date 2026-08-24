import { Data } from 'effect';

export class PracticeDatabaseError extends Data.TaggedError(
  'PracticeDatabaseError',
)<{
  readonly operation: string;
  readonly cause: unknown;
  readonly message: string;
}> {}

export class PracticeJudgeError extends Data.TaggedError('PracticeJudgeError')<{
  readonly cause: unknown;
  readonly message: string;
}> {}

export class StaleAnswerSubmissionError extends Data.TaggedError(
  'StaleAnswerSubmissionError',
)<{
  readonly message: string;
}> {}
