import { Schema } from 'effect';

export class CourseNotFoundError extends Schema.TaggedError<CourseNotFoundError>()(
  'CourseNotFoundError',
  { message: Schema.String },
) {}
