import { Data } from 'effect';

export class PageReviewOrderError extends Data.TaggedError(
  'PageReviewOrderError',
)<{
  readonly message: string;
}> {}
