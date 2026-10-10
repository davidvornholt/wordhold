import { maximumRelatedWords } from '@wordhold/ai/extraction/schema';
import {
  editedRelatedWords,
  parseRelatedWords,
  type RelatedWordListsData,
  type RelationKind,
  relatedWordsText,
  relationKinds,
} from '../../../shared/vocabulary/related-words';
import type { VocabularyEntry } from '../schemas/course-units';
import type {
  SaveWordRelationsData,
  SuggestedWordRelations,
} from '../schemas/word-relations';

export type RelationWord = Pick<
  VocabularyEntry,
  'id' | 'targetText' | 'nativeText' | 'synonyms' | 'antonyms'
>;

// What the review screen shows for one word: the typed lists, and which of
// them came from a suggestion the learner has not saved yet.
export type RelationDraft = {
  readonly texts: Readonly<Record<RelationKind, string>>;
  readonly suggested: Readonly<Record<RelationKind, boolean>>;
};

export type RelationDrafts = Readonly<Record<string, RelationDraft>>;

const storedDraft = (word: RelationWord): RelationDraft => ({
  texts: {
    synonyms: relatedWordsText(word.synonyms),
    antonyms: relatedWordsText(word.antonyms),
  },
  suggested: { synonyms: false, antonyms: false },
});

// A word added since the screen opened starts from what is stored.
export const relationDraft = (
  drafts: RelationDrafts,
  word: RelationWord,
): RelationDraft => drafts[word.id] ?? storedDraft(word);

// A list is open while nothing is stored, suggested or typed for it.
const isOpen = (word: RelationWord, draft: RelationDraft, kind: RelationKind) =>
  word[kind] === null &&
  !draft.suggested[kind] &&
  draft.texts[kind].trim() === '';

export const wordsToSuggest = (
  words: ReadonlyArray<RelationWord>,
  drafts: RelationDrafts,
): ReadonlyArray<RelationWord> =>
  words.filter((word) =>
    relationKinds.some((kind) =>
      isOpen(word, relationDraft(drafts, word), kind),
    ),
  );

// Fills the lists that are still open; a list the learner typed into while
// the suggestion was on its way keeps what they typed.
export const withSuggestions = (
  words: ReadonlyArray<RelationWord>,
  drafts: RelationDrafts,
  suggestions: ReadonlyArray<SuggestedWordRelations>,
): RelationDrafts => {
  const next: Record<string, RelationDraft> = { ...drafts };
  for (const suggestion of suggestions) {
    const word = words.find((candidate) => candidate.id === suggestion.entryId);
    if (word !== undefined) {
      const draft = relationDraft(next, word);
      const texts: Record<RelationKind, string> = { ...draft.texts };
      const suggested: Record<RelationKind, boolean> = { ...draft.suggested };
      for (const kind of relationKinds) {
        if (isOpen(word, draft, kind)) {
          texts[kind] = suggestion[kind].join(', ');
          suggested[kind] = true;
        }
      }
      next[word.id] = { texts, suggested };
    }
  }
  return next;
};

// The lists a save stores. A reviewed suggestion settles its list even when
// it is empty, so the word is not offered for a suggestion again.
const reviewedLists = (
  word: RelationWord,
  draft: RelationDraft,
): RelatedWordListsData => ({
  synonyms: draft.suggested.synonyms
    ? parseRelatedWords(draft.texts.synonyms)
    : editedRelatedWords(word.synonyms, draft.texts.synonyms),
  antonyms: draft.suggested.antonyms
    ? parseRelatedWords(draft.texts.antonyms)
    : editedRelatedWords(word.antonyms, draft.texts.antonyms),
});

export const tooManyRelatedWords = (text: string): boolean =>
  parseRelatedWords(text).length > maximumRelatedWords;

const sameList = (
  stored: ReadonlyArray<string> | null,
  reviewed: ReadonlyArray<string> | null,
) =>
  stored === null || reviewed === null
    ? stored === reviewed
    : stored.length === reviewed.length &&
      stored.every((word, index) => word === reviewed[index]);

export const changedRelations = (
  words: ReadonlyArray<RelationWord>,
  drafts: RelationDrafts,
): SaveWordRelationsData['words'] =>
  words.flatMap((word) => {
    const lists = reviewedLists(word, relationDraft(drafts, word));
    return relationKinds.every((kind) => sameList(word[kind], lists[kind]))
      ? []
      : [{ entryId: word.id, ...lists }];
  });

// After a save the stored lists match the drafts, so nothing counts as a
// pending suggestion any more.
export const settledDrafts = (drafts: RelationDrafts): RelationDrafts =>
  Object.fromEntries(
    Object.entries(drafts).map(([id, draft]) => [
      id,
      { ...draft, suggested: { synonyms: false, antonyms: false } },
    ]),
  );
