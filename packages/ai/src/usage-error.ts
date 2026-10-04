import { Data } from 'effect';

export class AiUsageError extends Data.TaggedError('AiUsageError')<{
  readonly cause?: unknown;
  readonly message: string;
}> {}
