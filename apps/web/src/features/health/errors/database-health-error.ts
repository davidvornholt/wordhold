import { Data } from 'effect';

export class DatabaseHealthError extends Data.TaggedError(
  'DatabaseHealthError',
)<{
  readonly message: string;
}> {}
