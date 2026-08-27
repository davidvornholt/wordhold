import { describe, expect, it } from 'bun:test';
import type { LearnItem } from '../schemas/learning-models';
import { matchesLearnItem } from './learn-check';

const item: LearnItem = {
  entryId: '00000000-0000-0000-0000-000000000001',
  targetText: 'to look (at)',
  nativeText: 'ansehen',
  hasAudio: false,
  textbookAnswers: ['to look (at)'],
};

describe('matchesLearnItem', () => {
  it('accepts the spelling shown on screen', () => {
    expect(matchesLearnItem(item, 'To Look (at)')).toBe(true);
  });

  it('accepts a bounded reading of textbook notation', () => {
    expect(matchesLearnItem(item, 'to look at')).toBe(true);
  });

  it('does not accept a semantic alternative proposed by the judge', () => {
    expect(matchesLearnItem(item, 'to watch')).toBe(false);
  });

  it('rejects a different word', () => {
    expect(matchesLearnItem(item, 'to watch')).toBe(false);
  });

  // Nothing on screen has been copied yet, and normalization strips trailing
  // punctuation, so whitespace alone must not open the next word.
  it('rejects an empty answer', () => {
    expect(matchesLearnItem(item, '  ')).toBe(false);
  });
});
