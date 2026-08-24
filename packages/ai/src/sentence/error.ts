import { Data } from 'effect';

export class SentenceGenError extends Data.TaggedError('SentenceGenError')<{
  readonly cause: unknown;
}> {}
