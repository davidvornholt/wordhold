import { describe, expect, it } from 'bun:test';
import { matchesShownAnswer } from './use-retype';

describe('matchesShownAnswer', () => {
  it('accepts the notation review grading accepts', () => {
    const shown = ['estar ilusionado/-a (con algo)'];
    expect(matchesShownAnswer(shown, 'estar ilusionado/a (con algo)')).toBe(
      true,
    );
    expect(matchesShownAnswer(shown, 'estar ilusionado/-a con algo')).toBe(
      true,
    );
    expect(matchesShownAnswer(shown, 'estar ilusionado/a (con nada)')).toBe(
      false,
    );
  });

  it('accepts any shown answer and rejects an empty copy', () => {
    const shown = ['to look (at)', 'to watch'];
    expect(matchesShownAnswer(shown, 'to watch')).toBe(true);
    expect(matchesShownAnswer(shown, 'to look at')).toBe(true);
    expect(matchesShownAnswer(shown, '  ')).toBe(false);
  });
});
