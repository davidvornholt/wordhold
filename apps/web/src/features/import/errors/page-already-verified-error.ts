import { Schema } from 'effect';

export class PageAlreadyVerifiedError extends Schema.TaggedError<PageAlreadyVerifiedError>()(
  'PageAlreadyVerifiedError',
  { message: Schema.String },
) {}
