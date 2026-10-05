import { Schema } from 'effect';

export class MediaDatabaseError extends Schema.TaggedError<MediaDatabaseError>()(
  'MediaDatabaseError',
  { message: Schema.String, cause: Schema.Unknown },
) {}
