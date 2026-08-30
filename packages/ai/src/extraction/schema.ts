import { Schema } from 'effect';

export const maximumEntriesPerPage = 100;
export const maximumEntryTextLength = 500;
export const maximumExampleLength = 1000;
export const maximumUnitNameLength = 80;
export const maximumPageNumber = 9999;
export const maximumGrammarFieldLength = 200;
export const maximumIrregularForms = 20;

const GrammarText = Schema.String.pipe(
  Schema.maxLength(maximumGrammarFieldLength),
);

// Flexible part-of-speech grammar, discriminated on `kind`. Stored as JSONB
// on entries; every language uses the subset of fields that applies.
const NounGrammar = Schema.TaggedStruct('noun', {
  gender: Schema.optional(Schema.Literal('masculine', 'feminine', 'neuter')),
  plural: Schema.optional(GrammarText),
});

const VerbGrammar = Schema.TaggedStruct('verb', {
  irregularForms: Schema.optional(
    Schema.Array(GrammarText).pipe(Schema.maxItems(maximumIrregularForms)),
  ),
  note: Schema.optional(GrammarText),
});

const AdjectiveGrammar = Schema.TaggedStruct('adjective', {
  comparative: Schema.optional(GrammarText),
  superlative: Schema.optional(GrammarText),
});

const OtherGrammar = Schema.TaggedStruct('other', {
  note: Schema.optional(GrammarText),
});

export const Grammar = Schema.Union(
  NounGrammar,
  VerbGrammar,
  AdjectiveGrammar,
  OtherGrammar,
);
export type GrammarInfo = typeof Grammar.Type;

export const ExtractedEntry = Schema.Struct({
  targetText: Schema.String.pipe(Schema.maxLength(maximumEntryTextLength)),
  nativeText: Schema.String.pipe(Schema.maxLength(maximumEntryTextLength)),
  grammar: Schema.optional(Grammar),
  example: Schema.optional(
    Schema.String.pipe(Schema.maxLength(maximumExampleLength)),
  ),
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
});
export type ExtractedEntryData = typeof ExtractedEntry.Type;

export const ExtractedPage = Schema.Struct({
  unitName: Schema.optional(
    Schema.String.pipe(Schema.maxLength(maximumUnitNameLength)),
  ),
  pageNumber: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.between(1, maximumPageNumber)),
  ),
  pageNumberConfidence: Schema.optional(
    Schema.Number.pipe(Schema.between(0, 1)),
  ),
  entries: Schema.Array(ExtractedEntry).pipe(
    Schema.maxItems(maximumEntriesPerPage),
  ),
  overallConfidence: Schema.Number.pipe(Schema.between(0, 1)),
});
export type ExtractedPageData = typeof ExtractedPage.Type;
