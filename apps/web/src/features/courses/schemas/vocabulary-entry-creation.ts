import { Schema } from 'effect';
import { Uuid } from '../../../shared/validate/uuid';
import {
  EntryText,
  ExampleText,
  NewExample,
} from '../../../shared/vocabulary/entry-fields';

// Where a typed word goes: a book, and optionally one of its units.
const WordPlaceFields = {
  bookId: Uuid,
  unitId: Schema.NullOr(Uuid),
};

// One typed vocabulary entry. The place is picked from existing books and
// units, so unlike the verify screen there is nothing to resolve by name.
export const CreateVocabularyEntry = Schema.Struct({
  courseId: Uuid,
  ...WordPlaceFields,
  targetText: EntryText,
  nativeText: EntryText,
  example: Schema.optional(NewExample),
});
export type CreateVocabularyEntryData = typeof CreateVocabularyEntry.Type;

export const VocabularyExampleRequest = Schema.Struct({
  courseId: Uuid,
  targetText: EntryText,
  nativeText: EntryText,
});
export type VocabularyExampleRequestData = typeof VocabularyExampleRequest.Type;

export const VocabularyTranslationRequest = Schema.Struct({
  courseId: Uuid,
  targetText: ExampleText,
});
export type VocabularyTranslationRequestData =
  typeof VocabularyTranslationRequest.Type;

// One typed side of a word pair; the other is proposed in the course's
// language or German. A unit gives the proposal its context.
export const VocabularyTranslationSuggestion = Schema.Struct({
  courseId: Uuid,
  ...WordPlaceFields,
  text: EntryText,
  given: Schema.Literals(['target', 'native']),
});
export type VocabularyTranslationSuggestionData =
  typeof VocabularyTranslationSuggestion.Type;

export const decodeCreateVocabularyEntry = Schema.decodeUnknownSync(
  CreateVocabularyEntry,
);
export const decodeVocabularyExampleRequest = Schema.decodeUnknownSync(
  VocabularyExampleRequest,
);
export const decodeVocabularyTranslationRequest = Schema.decodeUnknownSync(
  VocabularyTranslationRequest,
);
export const decodeVocabularyTranslationSuggestion = Schema.decodeUnknownSync(
  VocabularyTranslationSuggestion,
);
