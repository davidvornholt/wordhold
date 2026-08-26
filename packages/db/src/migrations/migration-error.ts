import { Data } from 'effect';

export class MigrationError extends Data.TaggedError('MigrationError')<{
  readonly cause: unknown;
  readonly message: string;
}> {}
