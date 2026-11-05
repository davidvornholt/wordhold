import { Schema } from 'effect';
import { Uuid } from '../../../shared/validate/uuid';
import { EntryText, NewExample } from '../../../shared/vocabulary/entry-fields';
import { RelatedWords } from '../../../shared/vocabulary/related-words';

// A word's texts as the learner corrected them. The word stays in its book
// or unit, and its cards keep their schedule. Without an example, a stored
// one is removed. Both lists of related words are stored as given.
export const UpdateVocabularyEntry = Schema.Struct({
  courseId: Uuid,
  entryId: Uuid,
  targetText: EntryText,
  nativeText: EntryText,
  example: Schema.optional(NewExample),
  synonyms: Schema.NullOr(RelatedWords),
  antonyms: Schema.NullOr(RelatedWords),
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

const EntryIds = Schema.Array(Uuid).check(Schema.isMinLength(1));

// Words or terms of the course, deleted with their cards and their history.
export const DeleteEntries = Schema.Struct({
  courseId: Uuid,
  entryIds: EntryIds,
});
export type DeleteEntriesData = typeof DeleteEntries.Type;

// Words of the course, moved together to a book of the same course or to one
// of its units. Their cards, schedule and answers stay with them.
export const MoveEntries = Schema.Struct({
  courseId: Uuid,
  entryIds: EntryIds,
  bookId: Uuid,
  unitId: Schema.NullOr(Uuid),
});
export type MoveEntriesData = typeof MoveEntries.Type;

export const decodeUpdateVocabularyEntry = Schema.decodeUnknownSync(
  UpdateVocabularyEntry,
);
export const decodeUpdateTermEntry = Schema.decodeUnknownSync(UpdateTermEntry);
export const decodeDeleteEntries = Schema.decodeUnknownSync(DeleteEntries);
export const decodeMoveEntries = Schema.decodeUnknownSync(MoveEntries);
