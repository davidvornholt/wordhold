import { Data } from 'effect';

export class PageNotFoundError extends Data.TaggedError('PageNotFoundError')<{
  readonly message: string;
}> {}
