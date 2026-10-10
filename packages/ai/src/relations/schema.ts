import { Schema } from 'effect';
import { maximumEntryTextLength } from '../extraction/schema';

// A suggestion is reviewed by the learner, so it stays to the few words a
// teacher would expect rather than every near-synonym a thesaurus lists.
export const maximumSuggestedRelations = 3;
// Words per request: enough for a textbook page, small enough that a slow
// or failed request costs little.
export const maximumRelationBatch = 20;

const RelatedWord = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(maximumEntryTextLength),
);

const SuggestedWords = Schema.Array(RelatedWord).check(
  Schema.isMaxLength(maximumSuggestedRelations),
);

// One entry per requested word, in the order the words were asked.
export const RelationSuggestions = Schema.Struct({
  words: Schema.Array(
    Schema.Struct({ synonyms: SuggestedWords, antonyms: SuggestedWords }),
  ),
});
export type RelationSuggestionsData = typeof RelationSuggestions.Type;

export type RelationWord = {
  readonly targetText: string;
  readonly nativeText: string;
  // An example sentence pins down the sense of a word with several meanings.
  readonly example: string | null;
};

export type RelationRequest = {
  readonly targetLanguage: string;
  readonly words: ReadonlyArray<RelationWord>;
};
