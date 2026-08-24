import { Schema } from 'effect';

// Flexible per-word-class grammar, discriminated on `kind`. Stored as JSONB
// on entries; every language uses the subset of fields that applies.
const NounGrammar = Schema.TaggedStruct('noun', {
  gender: Schema.optional(Schema.Literal('masculine', 'feminine', 'neuter')),
  plural: Schema.optional(Schema.String),
});

const VerbGrammar = Schema.TaggedStruct('verb', {
  irregularForms: Schema.optional(Schema.Array(Schema.String)),
  note: Schema.optional(Schema.String),
});

const AdjectiveGrammar = Schema.TaggedStruct('adjective', {
  comparative: Schema.optional(Schema.String),
  superlative: Schema.optional(Schema.String),
});

const OtherGrammar = Schema.TaggedStruct('other', {
  note: Schema.optional(Schema.String),
});

export const Grammar = Schema.Union(
  NounGrammar,
  VerbGrammar,
  AdjectiveGrammar,
  OtherGrammar,
);
export type GrammarInfo = typeof Grammar.Type;

export const ExtractedEntry = Schema.Struct({
  type: Schema.Literal('word', 'expression', 'sentence'),
  targetText: Schema.String,
  nativeText: Schema.String,
  grammar: Schema.optional(Grammar),
  example: Schema.optional(Schema.String),
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
});
export type ExtractedEntryData = typeof ExtractedEntry.Type;

export const ExtractedPage = Schema.Struct({
  pageLabel: Schema.optional(Schema.String),
  entries: Schema.Array(ExtractedEntry),
  overallConfidence: Schema.Number.pipe(Schema.between(0, 1)),
});
export type ExtractedPageData = typeof ExtractedPage.Type;
