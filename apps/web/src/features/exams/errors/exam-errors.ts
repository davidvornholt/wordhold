import { Schema } from 'effect';

export class ExamDatabaseError extends Schema.TaggedError<ExamDatabaseError>()(
  'ExamDatabaseError',
  { operation: Schema.String, cause: Schema.Unknown, message: Schema.String },
) {}

export class ExamNotFoundError extends Schema.TaggedError<ExamNotFoundError>()(
  'ExamNotFoundError',
  { message: Schema.String },
) {}

// The words or directions do not fit the course, such as a word from another
// course or a direction a subject has no cards for.
export class ExamInputError extends Schema.TaggedError<ExamInputError>()(
  'ExamInputError',
  { message: Schema.String },
) {}

// The test cannot do this right now: it is archived, or none of its cards
// has been learned yet.
export class ExamStateError extends Schema.TaggedError<ExamStateError>()(
  'ExamStateError',
  { message: Schema.String },
) {}
