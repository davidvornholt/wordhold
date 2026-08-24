import { Data } from 'effect';

export class AuthDatabaseError extends Data.TaggedError('AuthDatabaseError')<{
  readonly operation: string;
  readonly message: string;
  readonly cause: unknown;
}> {}
