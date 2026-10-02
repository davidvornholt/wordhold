import { Data } from 'effect';

export class SentenceJudgeError extends Data.TaggedError('SentenceJudgeError')<{
  readonly cause: unknown;
  readonly message: string;
}> {}
