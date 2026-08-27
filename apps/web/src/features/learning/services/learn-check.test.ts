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

  it('uses the shared textbook notation contract', () => {
    expect(
      matchesLearnItem(
        { ...item, targetText: 'amigo/a', textbookAnswers: ['amigo/a'] },
        'amiga',
      ),
    ).toBe(true);
  });

  it('accepts the displayed spelling but not an unproven overflow reading', () => {
    const overflow = 'aa/bb cc/dd ee/ff gg/hh ii/jj';
    const overflowItem = {
      ...item,
      targetText: overflow,
      textbookAnswers: [overflow],
    };
    expect(matchesLearnItem(overflowItem, overflow)).toBe(true);
    expect(matchesLearnItem(overflowItem, 'bb dd ff hh jj')).toBe(false);
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
