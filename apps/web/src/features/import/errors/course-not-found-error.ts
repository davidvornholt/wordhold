import { Data } from 'effect';

export class CourseNotFoundError extends Data.TaggedError(
  'CourseNotFoundError',
)<{
  readonly message: string;
}> {}
