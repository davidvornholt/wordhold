import { maximumRelatedWords } from '@wordhold/ai/extraction/schema';
import { Schema } from 'effect';
import { normalizeAnswer } from '../grading/normalize';
import { EntryText } from './entry-fields';

// Synonyms or antonyms of a word, in the course's target language.
export const RelatedWords = Schema.Array(EntryText).check(
  Schema.isMaxLength(maximumRelatedWords),
);

// Each list is null until it is settled by the textbook page, the learner or
// a reviewed suggestion, and empty once settled for a word that has none.
export const RelatedWordLists = Schema.Struct({
  synonyms: Schema.NullOr(RelatedWords),
  antonyms: Schema.NullOr(RelatedWords),
});
export type RelatedWordListsData = typeof RelatedWordLists.Type;

export const relationKinds = ['synonyms', 'antonyms'] as const;
export type RelationKind = (typeof relationKinds)[number];

export const relationLabels: Readonly<Record<RelationKind, string>> = {
  synonyms: 'Synonyme',
  antonyms: 'Gegenteile',
};

const separators = /[,;\n]/u;

// Each word once, without blanks and without the word they belong to.
export const distinctRelatedWords = (
  words: ReadonlyArray<string>,
  word = '',
): ReadonlyArray<string> => {
  const seen = new Set([normalizeAnswer(word)]);
  return words
    .map((candidate) => candidate.trim().replaceAll(/\s+/gu, ' '))
    .filter((candidate) => {
      const key = normalizeAnswer(candidate);
      if (key === '' || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

// The words of a typed list, separated by commas or semicolons.
export const parseRelatedWords = (text: string): ReadonlyArray<string> =>
  distinctRelatedWords(text.split(separators));

export const relatedWordsText = (words: ReadonlyArray<string> | null): string =>
  (words ?? []).join(', ');

// A list the learner left as it was keeps its stored value, so an untouched
// field neither settles an open list nor rewrites a settled one.
export const editedRelatedWords = (
  stored: ReadonlyArray<string> | null,
  text: string,
): ReadonlyArray<string> | null =>
  text.trim() === relatedWordsText(stored).trim()
    ? stored
    : parseRelatedWords(text);
