import { Data } from 'effect';

export class LearningDatabaseError extends Data.TaggedError(
  'LearningDatabaseError',
)<{
  readonly operation: string;
  readonly cause: unknown;
  readonly message: string;
}> {}

export class LearningPlaceNotFoundError extends Data.TaggedError(
  'LearningPlaceNotFoundError',
)<{
  readonly message: string;
}> {}

export class LearningCardNotFoundError extends Data.TaggedError(
  'LearningCardNotFoundError',
)<{
  readonly message: string;
}> {}
