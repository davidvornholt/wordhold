import { Option, Schema } from 'effect';

const VocabularySearch = Schema.Struct({
  filter: Schema.optional(
    Schema.Literal('all', 'due', 'first-reviews', 'difficult'),
  ),
});

export type VocabularyFilter = NonNullable<typeof VocabularySearch.Type.filter>;

const decodeSearch = Schema.decodeUnknownOption(VocabularySearch);

export const parseVocabularySearch = (input: unknown) =>
  Option.getOrElse(decodeSearch(input), () => ({ filter: 'all' as const }));
