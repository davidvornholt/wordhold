import { Schema } from 'effect';

// The uploaded file is not a Bible module Wordhold can read.
export class BibleModuleError extends Schema.TaggedError<BibleModuleError>()(
  'BibleModuleError',
  { message: Schema.String, cause: Schema.optional(Schema.Unknown) },
) {}

// The uploaded module could not be set aside to be read, which is the
// server's fault rather than the file's.
export class BibleFileError extends Schema.TaggedError<BibleFileError>()(
  'BibleFileError',
  { message: Schema.String, cause: Schema.Unknown },
) {}

export class BibleConflictError extends Schema.TaggedError<BibleConflictError>()(
  'BibleConflictError',
  { message: Schema.String },
) {}

export class BibleNotFoundError extends Schema.TaggedError<BibleNotFoundError>()(
  'BibleNotFoundError',
  { message: Schema.String },
) {}

export class BibleReferenceError extends Schema.TaggedError<BibleReferenceError>()(
  'BibleReferenceError',
  { message: Schema.String },
) {}

export class PassageNotFoundError extends Schema.TaggedError<PassageNotFoundError>()(
  'PassageNotFoundError',
  { message: Schema.String },
) {}

export class PassageTooLongError extends Schema.TaggedError<PassageTooLongError>()(
  'PassageTooLongError',
  { message: Schema.String },
) {}

export class BibleDatabaseError extends Schema.TaggedError<BibleDatabaseError>()(
  'BibleDatabaseError',
  { operation: Schema.String, cause: Schema.Unknown, message: Schema.String },
) {}
