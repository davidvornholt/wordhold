import { describe, expect, it } from 'bun:test';
import type { LearnItem } from '../schemas/learning-models';
import { matchesLearnItem } from './learn-check';

const item: LearnItem = {
  cardId: '00000000-0000-0000-0000-000000000011',
  direction: 'to_target',
  entryId: '00000000-0000-0000-0000-000000000001',
  unitId: '00000000-0000-0000-0000-000000000002',
  targetText: 'to look (at)',
  nativeText: 'ansehen',
  hasAudio: false,
  example: null,
  textbookAnswers: ['to look (at)'],
};

describe('matchesLearnItem', () => {
  it('accepts the prompted spelling', () => {
    expect(matchesLearnItem(item, 'To Look (at)')).toBe(true);
  });

  it('checks the native answer when learning the reverse direction', () => {
    expect(
      matchesLearnItem(
        {
          ...item,
          direction: 'to_native',
          textbookAnswers: ['ansehen'],
        },
        'Ansehen',
      ),
    ).toBe(true);
    expect(
      matchesLearnItem(
        {
          ...item,
          direction: 'to_native',
          textbookAnswers: ['ansehen'],
        },
        'to look at',
      ),
    ).toBe(false);
  });

  it('accepts a bounded reading of textbook notation', () => {
    expect(matchesLearnItem(item, 'to look at')).toBe(true);
  });

  it('ignores commas and flexible spacing around textbook separators', () => {
    expect(
      matchesLearnItem(
        {
          ...item,
          targetText: 'hello, world',
          textbookAnswers: ['hello, world'],
        },
        'hello world',
      ),
    ).toBe(true);
    expect(
      matchesLearnItem(
        {
          ...item,
          targetText: 'amigo / a',
          textbookAnswers: ['amigo / a'],
        },
        'amiga',
      ),
    ).toBe(true);
  });

  it('uses the shared textbook notation contract', () => {
    expect(
      matchesLearnItem(
        { ...item, targetText: 'amigo/a', textbookAnswers: ['amigo/a'] },
        'amiga',
      ),
    ).toBe(true);
    expect(
      matchesLearnItem(
        {
          ...item,
          targetText: 'lingua franca; Verkehrssprache',
          textbookAnswers: ['lingua franca; Verkehrssprache'],
        },
        'Verkehrssprache',
      ),
    ).toBe(true);
  });

  it('accepts the prompted spelling but not an unproven overflow reading', () => {
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

  it('rejects a different entry', () => {
    expect(matchesLearnItem(item, 'to watch')).toBe(false);
  });

  // Nothing on screen has been copied yet, and normalization strips trailing
  // punctuation, so whitespace alone must not open the next direction.
  it('rejects an empty answer', () => {
    expect(matchesLearnItem(item, '  ')).toBe(false);
  });
});
