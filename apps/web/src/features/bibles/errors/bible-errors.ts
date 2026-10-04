import { Data } from 'effect';

// The uploaded file is not a Bible module Wordhold can read.
export class BibleModuleError extends Data.TaggedError('BibleModuleError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// The uploaded module could not be set aside to be read, which is the
// server's fault rather than the file's.
export class BibleFileError extends Data.TaggedError('BibleFileError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class BibleConflictError extends Data.TaggedError('BibleConflictError')<{
  readonly message: string;
}> {}

export class BibleNotFoundError extends Data.TaggedError('BibleNotFoundError')<{
  readonly message: string;
}> {}

export class BibleReferenceError extends Data.TaggedError(
  'BibleReferenceError',
)<{
  readonly message: string;
}> {}

export class PassageNotFoundError extends Data.TaggedError(
  'PassageNotFoundError',
)<{
  readonly message: string;
}> {}

export class PassageTooLongError extends Data.TaggedError(
  'PassageTooLongError',
)<{
  readonly message: string;
}> {}

export class BibleDatabaseError extends Data.TaggedError('BibleDatabaseError')<{
  readonly operation: string;
  readonly cause: unknown;
  readonly message: string;
}> {}
