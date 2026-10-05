import { KeyPoints } from '@wordhold/ai/definition/schema';
import { Schema } from 'effect';
import { Uuid } from '../../../shared/validate/uuid';
import { EntryText } from '../../../shared/vocabulary/entry-fields';

// A subject keeps its terms in one list, so a term names only its subject.
export const CreateTermEntry = Schema.Struct({
  courseId: Uuid,
  term: EntryText,
  definition: EntryText,
});
export type CreateTermEntryData = typeof CreateTermEntry.Type;

// A term whose definition is proposed on request. The subject tells apart
// meanings the term has elsewhere.
export const TermDefinitionSuggestion = Schema.Struct({
  courseId: Uuid,
  term: EntryText,
});
export type TermDefinitionSuggestionData = typeof TermDefinitionSuggestion.Type;

export const TermKeyPointsRequest = Schema.Struct({
  courseId: Uuid,
  entryId: Uuid,
});
export type TermKeyPointsRequestData = typeof TermKeyPointsRequest.Type;

export const UpdateTermKeyPoints = Schema.Struct({
  courseId: Uuid,
  entryId: Uuid,
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
