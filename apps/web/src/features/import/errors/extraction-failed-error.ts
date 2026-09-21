import { Data } from 'effect';

export class ExtractionFailedError extends Data.TaggedError(
  'ExtractionFailedError',
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}
