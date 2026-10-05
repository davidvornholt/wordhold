import { Schema } from 'effect';

export class PageReviewOrderError extends Schema.TaggedError<PageReviewOrderError>()(
  'PageReviewOrderError',
  { message: Schema.String },
) {}
