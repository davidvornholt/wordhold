import { Data } from 'effect';

export class FileReferenceError extends Data.TaggedError('FileReferenceError')<{
  readonly persistenceError: unknown;
  readonly cleanupError: unknown;
  readonly message: string;
}> {}
