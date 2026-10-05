import { Schema } from 'effect';

export class PageNotFoundError extends Schema.TaggedError<PageNotFoundError>()(
  'PageNotFoundError',
  { message: Schema.String },
) {}
