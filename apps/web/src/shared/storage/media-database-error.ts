import { Data } from 'effect';

export class MediaDatabaseError extends Data.TaggedError('MediaDatabaseError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}
