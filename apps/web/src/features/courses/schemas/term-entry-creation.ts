import { KeyPoints } from '@wordhold/ai/definition/schema';
import { Schema } from 'effect';
import { EntryText } from '../../../shared/vocabulary/entry-fields';

// Where a typed term goes: a book, and optionally one of its units.
const TermPlaceFields = {
  bookId: Schema.UUID,
  unitId: Schema.NullOr(Schema.UUID),
};

export const CreateTermEntry = Schema.Struct({
  courseId: Schema.UUID,
  ...TermPlaceFields,
  term: EntryText,
  definition: EntryText,
});
export type CreateTermEntryData = typeof CreateTermEntry.Type;

// A term whose definition is proposed on request. The subject and the unit
// tell apart meanings the term has elsewhere.
export const TermDefinitionSuggestion = Schema.Struct({
  courseId: Schema.UUID,
  ...TermPlaceFields,
  term: EntryText,
});
export type TermDefinitionSuggestionData = typeof TermDefinitionSuggestion.Type;

export const TermKeyPointsRequest = Schema.Struct({
  courseId: Schema.UUID,
  entryId: Schema.UUID,
});
export type TermKeyPointsRequestData = typeof TermKeyPointsRequest.Type;

export const UpdateTermKeyPoints = Schema.Struct({
  courseId: Schema.UUID,
  entryId: Schema.UUID,
  keyPoints: KeyPoints,
});
export type UpdateTermKeyPointsData = typeof UpdateTermKeyPoints.Type;

export const decodeCreateTermEntry = Schema.decodeUnknownSync(CreateTermEntry);
export const decodeTermDefinitionSuggestion = Schema.decodeUnknownSync(
  TermDefinitionSuggestion,
);
export const decodeTermKeyPointsRequest =
  Schema.decodeUnknownSync(TermKeyPointsRequest);
export const decodeUpdateTermKeyPoints =
  Schema.decodeUnknownSync(UpdateTermKeyPoints);
