import { Data } from 'effect';

export class ExtractionError extends Data.TaggedError('ExtractionError')<{
  readonly cause: unknown;
}> {}
