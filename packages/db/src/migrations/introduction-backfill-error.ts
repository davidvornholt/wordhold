import { Data } from 'effect';

export class IntroductionBackfillError extends Data.TaggedError(
  'IntroductionBackfillError',
)<{
  readonly operation: string;
  readonly cause: unknown;
  readonly message: string;
}> {}
