import { Data } from 'effect';

// The verify screen offers the books a course had when it loaded. A book that
// is gone since then must fail instead of filing the page somewhere else.
export class BookNotFoundError extends Data.TaggedError('BookNotFoundError')<{
  readonly message: string;
}> {}
