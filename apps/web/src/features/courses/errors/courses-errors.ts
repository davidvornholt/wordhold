import { Data } from 'effect';

export class CourseSettingsDatabaseError extends Data.TaggedError(
  'CourseSettingsDatabaseError',
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
