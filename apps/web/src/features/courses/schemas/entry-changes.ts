import { Schema } from 'effect';
import { Uuid } from '../../../shared/validate/uuid';
import { EntryText, NewExample } from '../../../shared/vocabulary/entry-fields';

// A word's texts as the learner corrected them. The word stays in its book
// or unit, and its cards keep their schedule. Without an example, a stored
// one is removed.
export const UpdateVocabularyEntry = Schema.Struct({
  courseId: Uuid,
  entryId: Uuid,
  targetText: EntryText,
  nativeText: EntryText,
  example: Schema.optional(NewExample),
});
export type UpdateVocabularyEntryData = typeof UpdateVocabularyEntry.Type;

// A term and its definition as the learner corrected them. The card keeps
// its schedule.
export const UpdateTermEntry = Schema.Struct({
  courseId: Uuid,
  entryId: Uuid,
  term: EntryText,
  definition: EntryText,
});
export type UpdateTermEntryData = typeof UpdateTermEntry.Type;

// A word or term of the course, deleted with its cards and their history.
export const DeleteEntry = Schema.Struct({
  courseId: Uuid,
  entryId: Uuid,
});
export type DeleteEntryData = typeof DeleteEntry.Type;

export const decodeUpdateVocabularyEntry = Schema.decodeUnknownSync(
  UpdateVocabularyEntry,
);
export const decodeUpdateTermEntry = Schema.decodeUnknownSync(UpdateTermEntry);
export const decodeDeleteEntry = Schema.decodeUnknownSync(DeleteEntry);
