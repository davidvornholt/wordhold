import { Option, Schema } from 'effect';

const VocabularySearch = Schema.Struct({
  filter: Schema.optional(
    Schema.Literal('all', 'due', 'first-reviews', 'difficult'),
  ),
  // A book or unit to show on arrival.
  place: Schema.optional(Schema.UUID),
});

export type VocabularyFilter = NonNullable<typeof VocabularySearch.Type.filter>;
export type VocabularySearchData = typeof VocabularySearch.Type;

const decodeSearch = Schema.decodeUnknownOption(VocabularySearch);

export const parseVocabularySearch = (input: unknown): VocabularySearchData =>
  Option.getOrElse(
    decodeSearch(input),
    (): VocabularySearchData => ({ filter: 'all' }),
  );
