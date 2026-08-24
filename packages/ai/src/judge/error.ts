import { Data } from 'effect';

export class JudgeError extends Data.TaggedError('JudgeError')<{
  readonly cause: unknown;
}> {}
