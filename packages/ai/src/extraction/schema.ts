import { Schema } from 'effect';

export const maximumEntriesPerPage = 100;
export const maximumEntryTextLength = 500;
export const maximumExampleLength = 1000;
export const maximumUnitNameLength = 80;
export const maximumPageNumber = 9999;
export const maximumRelatedWords = 8;

const RelatedWords = Schema.Array(
  Schema.String.check(Schema.isMaxLength(maximumEntryTextLength)),
).check(Schema.isMaxLength(maximumRelatedWords));

export const ExtractedEntry = Schema.Struct({
  targetText: Schema.String.check(Schema.isMaxLength(maximumEntryTextLength)),
  nativeText: Schema.String.check(Schema.isMaxLength(maximumEntryTextLength)),
  example: Schema.optional(
    Schema.String.check(Schema.isMaxLength(maximumExampleLength)),
  ),
  // The model's German rendering of the printed example. Not on the page,
  // so it is reviewed and editable before import like a generated sentence.
  exampleTranslation: Schema.optional(
    Schema.String.check(Schema.isMaxLength(maximumExampleLength)),
  ),
  // Only what the page prints beside the entry, such as a synonym or an
  // opposite marked with an arrow; never the model's own suggestions.
  synonyms: Schema.optional(RelatedWords),
  antonyms: Schema.optional(RelatedWords),
  confidence: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
});
export type ExtractedEntryData = typeof ExtractedEntry.Type;

export const ExtractedPage = Schema.Struct({
  unitName: Schema.optional(
    Schema.String.check(Schema.isMaxLength(maximumUnitNameLength)),
  ),
  pageNumber: Schema.optional(
    Schema.Finite.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 1, maximum: maximumPageNumber }),
    ),
  ),
  pageNumberConfidence: Schema.optional(
    Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
  ),
  entries: Schema.Array(ExtractedEntry).check(
    Schema.isMaxLength(maximumEntriesPerPage),
  ),
  overallConfidence: Schema.Finite.check(
    Schema.isBetween({ minimum: 0, maximum: 1 }),
  ),
});
export type ExtractedPageData = typeof ExtractedPage.Type;
