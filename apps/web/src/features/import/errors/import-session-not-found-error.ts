import { Data } from 'effect';

export class ImportSessionNotFoundError extends Data.TaggedError(
  'ImportSessionNotFoundError',
)<{
  readonly message: string;
}> {}
