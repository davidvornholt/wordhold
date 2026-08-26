import { Data } from 'effect';

export class UnitBackfillError extends Data.TaggedError('UnitBackfillError')<{
  readonly cause: unknown;
  readonly message: string;
  readonly operation: string;
}> {}
