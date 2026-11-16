import { Schema } from 'effect';

export class CourseDatabaseError extends Schema.TaggedError<CourseDatabaseError>()(
  'CourseDatabaseError',
  { operation: Schema.String, cause: Schema.Unknown, message: Schema.String },
) {}

export class CourseSettingsNotFoundError extends Schema.TaggedError<CourseSettingsNotFoundError>()(
  'CourseSettingsNotFoundError',
  { message: Schema.String },
) {}

export class CourseUnitConflictError extends Schema.TaggedError<CourseUnitConflictError>()(
  'CourseUnitConflictError',
  { message: Schema.String },
) {}

export class CourseUnitOrderChangedError extends Schema.TaggedError<CourseUnitOrderChangedError>()(
  'CourseUnitOrderChangedError',
  { message: Schema.String },
) {}

export class CourseBookConflictError extends Schema.TaggedError<CourseBookConflictError>()(
  'CourseBookConflictError',
  { message: Schema.String },
) {}

export class CourseBookNotFoundError extends Schema.TaggedError<CourseBookNotFoundError>()(
  'CourseBookNotFoundError',
  { message: Schema.String },
) {}

export class CourseUnitNotFoundError extends Schema.TaggedError<CourseUnitNotFoundError>()(
  'CourseUnitNotFoundError',
  { message: Schema.String },
) {}

export class VocabularyEntryNotFoundError extends Schema.TaggedError<VocabularyEntryNotFoundError>()(
  'VocabularyEntryNotFoundError',
  { message: Schema.String },
) {}

export class VocabularyEntryConflictError extends Schema.TaggedError<VocabularyEntryConflictError>()(
  'VocabularyEntryConflictError',
  { targetText: Schema.String, message: Schema.String },
) {}

export const staleEntryEditMessage =
  'Dieser Eintrag wurde inzwischen an anderer Stelle geändert, deshalb ist deine Änderung nicht gespeichert. Lade die Seite neu und ändere ihn dann noch einmal.';

// An entry was saved from an editor that loaded an older version of it.
export class StaleEntryEditError extends Schema.TaggedError<StaleEntryEditError>()(
  'StaleEntryEditError',
  { message: Schema.String },
) {}

export const staleEntryEdit = new StaleEntryEditError({
  message: staleEntryEditMessage,
});

export class CourseExampleGenerationError extends Schema.TaggedError<CourseExampleGenerationError>()(
  'CourseExampleGenerationError',
  { message: Schema.String },
) {}

export class WordRelationSuggestionError extends Schema.TaggedError<WordRelationSuggestionError>()(
  'WordRelationSuggestionError',
  { message: Schema.String },
) {}

export class SubjectConflictError extends Schema.TaggedError<SubjectConflictError>()(
  'SubjectConflictError',
  { message: Schema.String },
) {}

// A language action asked of a subject, or a subject action of a language
// course, such as photographing a page for a subject.
export class CourseKindMismatchError extends Schema.TaggedError<CourseKindMismatchError>()(
  'CourseKindMismatchError',
  { message: Schema.String },
) {}

export class TermAssistError extends Schema.TaggedError<TermAssistError>()(
  'TermAssistError',
  { message: Schema.String },
) {}
