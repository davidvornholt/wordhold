import { Data } from 'effect';

export class ImportDatabaseError extends Data.TaggedError(
  'ImportDatabaseError',
)<{
  readonly operation: string;
  readonly cause: unknown;
  readonly message: string;
}> {}
