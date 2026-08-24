import { Data } from 'effect';

export class ImportInvariantError extends Data.TaggedError(
  'ImportInvariantError',
)<{
  readonly message: string;
}> {}
