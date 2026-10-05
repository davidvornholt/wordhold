import { Schema } from 'effect';

export class LearningDatabaseError extends Schema.TaggedError<LearningDatabaseError>()(
  'LearningDatabaseError',
  { operation: Schema.String, cause: Schema.Unknown, message: Schema.String },
) {}

export class LearningPlaceNotFoundError extends Schema.TaggedError<LearningPlaceNotFoundError>()(
  'LearningPlaceNotFoundError',
  { message: Schema.String },
) {}

export class LearningCardNotFoundError extends Schema.TaggedError<LearningCardNotFoundError>()(
  'LearningCardNotFoundError',
  { message: Schema.String },
) {}
