import { Data } from 'effect';

export class AuthorizationError extends Data.TaggedError('AuthorizationError')<{
  readonly message: string;
}> {}
