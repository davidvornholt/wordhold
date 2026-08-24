import { Data } from 'effect';

export class PageNotPendingError extends Data.TaggedError(
  'PageNotPendingError',
)<{
  readonly message: string;
}> {}
