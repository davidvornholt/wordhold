import { Schema } from 'effect';
import {
  EntryText,
  ExampleText,
  NewExample,
} from '../../../shared/vocabulary/entry-fields';

// One vocabulary entry typed on the unit screen. The unit is fixed by the
// screen, so unlike the verify screen there is nothing to resolve by name.
export const CreateVocabularyEntry = Schema.Struct({
  courseId: Schema.UUID,
  unitId: Schema.UUID,
  targetText: EntryText,
  nativeText: EntryText,
  example: Schema.optional(NewExample),
});
export type CreateVocabularyEntryData = typeof CreateVocabularyEntry.Type;

export const VocabularyExampleRequest = Schema.Struct({
  courseId: Schema.UUID,
  targetText: EntryText,
  nativeText: EntryText,
});
export type VocabularyExampleRequestData = typeof VocabularyExampleRequest.Type;

export const VocabularyTranslationRequest = Schema.Struct({
  courseId: Schema.UUID,
  targetText: ExampleText,
});
export type VocabularyTranslationRequestData =
  typeof VocabularyTranslationRequest.Type;

export const decodeCreateVocabularyEntry = Schema.decodeUnknownSync(
  CreateVocabularyEntry,
);
export const decodeVocabularyExampleRequest = Schema.decodeUnknownSync(
  VocabularyExampleRequest,
);
export const decodeVocabularyTranslationRequest = Schema.decodeUnknownSync(
  VocabularyTranslationRequest,
);
