import { Data } from 'effect';

export class MediaNotFoundError extends Data.TaggedError('MediaNotFoundError')<{
  readonly message: string;
}> {}
