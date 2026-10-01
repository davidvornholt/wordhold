import { describe, expect, it } from 'bun:test';
import { matchesShownAnswer } from './use-retype';

describe('matchesShownAnswer', () => {
  it('accepts the notation review grading accepts', () => {
    const shown = 'estar ilusionado/-a (con algo)';
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

  it('accepts a reading of the template and rejects an empty copy', () => {
    expect(matchesShownAnswer('to look (at)', 'to look at')).toBe(true);
    expect(matchesShownAnswer('to look (at)', 'to watch')).toBe(false);
    expect(matchesShownAnswer('to look (at)', '  ')).toBe(false);
  });
});
