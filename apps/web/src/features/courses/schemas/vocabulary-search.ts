import { Option, Schema } from 'effect';

const Filter = Schema.Literal('all', 'due', 'first-reviews', 'difficult');

const VocabularySearch = Schema.Struct({
  filter: Schema.optional(Filter),
  // A book or unit to show on arrival.
  place: Schema.optional(Schema.UUID),
});

// A subject's page is its list of terms, so it takes the list's filter.
const SubjectSearch = Schema.Struct({ filter: Schema.optional(Filter) });

export type VocabularyFilter = typeof Filter.Type;
export type VocabularySearchData = typeof VocabularySearch.Type;
export type SubjectSearchData = typeof SubjectSearch.Type;

const decodeSearch = Schema.decodeUnknownOption(VocabularySearch);
const decodeSubjectSearch = Schema.decodeUnknownOption(SubjectSearch);

export const parseVocabularySearch = (input: unknown): VocabularySearchData =>
  Option.getOrElse(
    decodeSearch(input),
    (): VocabularySearchData => ({ filter: 'all' }),
  );

export const parseSubjectSearch = (input: unknown): SubjectSearchData =>
  Option.getOrElse(decodeSubjectSearch(input), (): SubjectSearchData => ({}));
