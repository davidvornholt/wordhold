import { Data } from 'effect';

export class LearningDatabaseError extends Data.TaggedError(
  'LearningDatabaseError',
)<{
  readonly operation: string;
  readonly cause: unknown;
  readonly message: string;
}> {}

export class LearningUnitNotFoundError extends Data.TaggedError(
  'LearningUnitNotFoundError',
)<{
  readonly message: string;
}> {}

export class LearningEntryNotFoundError extends Data.TaggedError(
  'LearningEntryNotFoundError',
)<{
  readonly message: string;
}> {}
