import { Data } from 'effect';

export class PeopleDatabaseError extends Data.TaggedError(
  'PeopleDatabaseError',
)<{
  readonly operation: string;
  readonly cause: unknown;
  readonly message: string;
}> {}

// The person was deleted in the meantime, or the request named the
// administrator, whose access cannot be changed here.
export class PersonNotFoundError extends Data.TaggedError(
  'PersonNotFoundError',
)<{
  readonly message: string;
}> {}

export class PersonSuspendedError extends Data.TaggedError(
  'PersonSuspendedError',
)<{
  readonly message: string;
}> {}
