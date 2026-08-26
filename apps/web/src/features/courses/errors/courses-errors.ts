import { Data } from 'effect';

export class CourseDatabaseError extends Data.TaggedError(
  'CourseDatabaseError',
)<{
  readonly operation: string;
  readonly cause: unknown;
  readonly message: string;
}> {}

export class CourseSettingsNotFoundError extends Data.TaggedError(
  'CourseSettingsNotFoundError',
)<{
  readonly message: string;
}> {}
