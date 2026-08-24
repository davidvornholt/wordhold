import { Data } from 'effect';

export class DashboardDatabaseError extends Data.TaggedError(
  'DashboardDatabaseError',
)<{
  readonly cause: unknown;
  readonly message: string;
}> {}
