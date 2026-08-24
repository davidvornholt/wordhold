import { Data } from 'effect';

export class UploadReadError extends Data.TaggedError('UploadReadError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}
