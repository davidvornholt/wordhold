import { maximumRelationBatch } from '@wordhold/ai/relations/schema';
import { Option, Schema } from 'effect';
import { Uuid } from '../../../shared/validate/uuid';
import { RelatedWordLists } from '../../../shared/vocabulary/related-words';

// The words of one request for suggested synonyms and antonyms.
export const WordRelationRequest = Schema.Struct({
  courseId: Uuid,
  entryIds: Schema.Array(Uuid).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(maximumRelationBatch),
  ),
});
export type WordRelationRequestData = typeof WordRelationRequest.Type;

// More than any book's own words or unit holds.
export const maximumRelationSaves = 1000;

// The reviewed lists of the words the learner changed on one book or unit.
export const SaveWordRelations = Schema.Struct({
  courseId: Uuid,
  words: Schema.Array(
    Schema.Struct({ entryId: Uuid, ...RelatedWordLists.fields }),
  ).check(Schema.isMinLength(1), Schema.isMaxLength(maximumRelationSaves)),
});
export type SaveWordRelationsData = typeof SaveWordRelations.Type;

export type SuggestedWordRelations = {
  readonly entryId: string;
  readonly synonyms: ReadonlyArray<string>;
  readonly antonyms: ReadonlyArray<string>;
};

export const decodeWordRelationRequest =
  Schema.decodeUnknownSync(WordRelationRequest);
export const decodeSaveWordRelations =
  Schema.decodeUnknownSync(SaveWordRelations);

const RelationSearch = Schema.Struct({
  book: Schema.optional(Uuid),
  unit: Schema.optional(Uuid),
});
export type RelationSearchData = typeof RelationSearch.Type;

const decodeRelationSearch = Schema.decodeUnknownOption(RelationSearch);

// A hand-edited URL falls back to no book or unit, which leads back to the
// course.
export const parseRelationSearch = (input: unknown): RelationSearchData =>
  Option.getOrElse(decodeRelationSearch(input), (): RelationSearchData => ({}));
