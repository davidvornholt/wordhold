import { Schema } from 'effect';

export class PageNotPendingError extends Schema.TaggedError<PageNotPendingError>()(
  'PageNotPendingError',
  { message: Schema.String },
) {}
