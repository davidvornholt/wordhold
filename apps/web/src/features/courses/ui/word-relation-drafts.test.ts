import { describe, expect, it } from 'bun:test';
import {
  changedRelations,
  type RelationWord,
  relationDraft,
  settledDrafts,
  tooManyRelatedWords,
  withSuggestions,
  wordsToSuggest,
} from './word-relation-drafts';

const word = (
  id: string,
  targetText: string,
  lists: Pick<RelationWord, 'synonyms' | 'antonyms'>,
): RelationWord => ({ id, targetText, nativeText: targetText, ...lists });

const open = word('open', 'hostile', { synonyms: null, antonyms: null });
const printed = word('printed', 'brave', {
  synonyms: ['courageous'],
  antonyms: null,
});
const settled = word('settled', 'table', { synonyms: [], antonyms: [] });
const words = [open, printed, settled];

describe('word relation drafts', () => {
  it('offers words with an open list for a suggestion', () => {
    expect(wordsToSuggest(words, {})).toEqual([open, printed]);
  });

  it('fills only open lists and keeps what the learner typed meanwhile', () => {
    const typed = {
      open: {
        texts: { synonyms: 'unfriendly', antonyms: '' },
        suggested: { synonyms: false, antonyms: false },
      },
    };
    const drafts = withSuggestions(words, typed, [
      { entryId: 'open', synonyms: ['aggressive'], antonyms: ['friendly'] },
      { entryId: 'printed', synonyms: ['bold'], antonyms: [] },
    ]);
    expect(drafts.open).toEqual({
      texts: { synonyms: 'unfriendly', antonyms: 'friendly' },
      suggested: { synonyms: false, antonyms: true },
    });
    expect(drafts.printed).toEqual({
      texts: { synonyms: 'courageous', antonyms: '' },
      suggested: { synonyms: false, antonyms: true },
    });
    expect(wordsToSuggest(words, drafts)).toEqual([]);
  });

  it('saves only changed words and settles an empty suggestion', () => {
    const drafts = withSuggestions(words, {}, [
      { entryId: 'printed', synonyms: [], antonyms: [] },
    ]);
    expect(changedRelations(words, drafts)).toEqual([
      { entryId: 'printed', synonyms: ['courageous'], antonyms: [] },
    ]);
    expect(changedRelations(words, settledDrafts(drafts))).toEqual([]);
  });

  it('keeps a stored list whose text only changed in spacing', () => {
    const drafts = {
      printed: {
        ...relationDraft({}, printed),
        texts: { synonyms: ' courageous ', antonyms: '' },
      },
      settled: {
        ...relationDraft({}, settled),
        texts: { synonyms: 'desk; Desk', antonyms: '' },
      },
    };
    expect(changedRelations(words, drafts)).toEqual([
      { entryId: 'settled', synonyms: ['desk'], antonyms: [] },
    ]);
  });

  it('flags a list longer than a word can keep', () => {
    expect(tooManyRelatedWords('a, b, c, d, e, f, g, h')).toBe(false);
    expect(tooManyRelatedWords('a, b, c, d, e, f, g, h, i')).toBe(true);
  });
});
