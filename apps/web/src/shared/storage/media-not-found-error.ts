import { Schema } from 'effect';

export class MediaNotFoundError extends Schema.TaggedError<MediaNotFoundError>()(
  'MediaNotFoundError',
  { message: Schema.String },
) {}
