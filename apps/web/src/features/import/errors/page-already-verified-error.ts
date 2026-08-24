import { Data } from 'effect';

export class PageAlreadyVerifiedError extends Data.TaggedError(
  'PageAlreadyVerifiedError',
)<{
  readonly message: string;
}> {}
