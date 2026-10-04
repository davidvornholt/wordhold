import { Data } from 'effect';

export class SttError extends Data.TaggedError('SttError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}
