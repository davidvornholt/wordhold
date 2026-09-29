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

export class CourseUnitConflictError extends Data.TaggedError(
  'CourseUnitConflictError',
)<{
  readonly message: string;
}> {}

export class CourseUnitOrderChangedError extends Data.TaggedError(
  'CourseUnitOrderChangedError',
)<{
  readonly message: string;
}> {}

export class CourseBookConflictError extends Data.TaggedError(
  'CourseBookConflictError',
)<{
  readonly message: string;
}> {}

export class CourseBookNotFoundError extends Data.TaggedError(
  'CourseBookNotFoundError',
)<{
  readonly message: string;
}> {}

export class CourseUnitNotFoundError extends Data.TaggedError(
  'CourseUnitNotFoundError',
)<{
  readonly message: string;
}> {}

export class VocabularyEntryNotFoundError extends Data.TaggedError(
  'VocabularyEntryNotFoundError',
)<{
  readonly message: string;
}> {}

export class VocabularyEntryConflictError extends Data.TaggedError(
  'VocabularyEntryConflictError',
)<{
  readonly targetText: string;
  readonly message: string;
}> {}

export class CourseExampleGenerationError extends Data.TaggedError(
  'CourseExampleGenerationError',
)<{
  readonly message: string;
}> {}

export class SubjectConflictError extends Data.TaggedError(
  'SubjectConflictError',
)<{
  readonly message: string;
}> {}

// A language action asked of a subject, or a subject action of a language
// course, such as photographing a page for a subject.
export class CourseKindMismatchError extends Data.TaggedError(
  // biome-ignore lint/security/noSecrets: this stable Effect tag is not a credential
  'CourseKindMismatchError',
)<{
  readonly message: string;
}> {}

export class TermAssistError extends Data.TaggedError('TermAssistError')<{
  readonly message: string;
}> {}
