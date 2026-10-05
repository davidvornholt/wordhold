import { describe, expect, it } from 'bun:test';
import { matchesShownAnswer } from './use-retype';

describe('matchesShownAnswer', () => {
  it('accepts the notation review grading accepts', () => {
    const shown = 'estar ilusionado/-a (con algo)';
    expect(
      matchesShownAnswer(shown, 'estar ilusionado/a (con algo)', 'language'),
    ).toBe(true);
    expect(
      matchesShownAnswer(shown, 'estar ilusionado/-a con algo', 'language'),
    ).toBe(true);
    expect(
      matchesShownAnswer(shown, 'estar ilusionado/a (con nada)', 'language'),
    ).toBe(false);
  });

  it('accepts a reading of the template and rejects an empty copy', () => {
    expect(matchesShownAnswer('to look (at)', 'to look at', 'language')).toBe(
      true,
    );
    expect(matchesShownAnswer('to look (at)', 'to watch', 'language')).toBe(
      false,
    );
    expect(matchesShownAnswer('to look (at)', '  ', 'language')).toBe(false);
  });

  it('compares a text word for word and forgives no typo', () => {
    const verse = 'Denn so hat Gott die Welt geliebt.';
    expect(
      matchesShownAnswer(verse, 'denn so hat gott die welt geliebt', 'texts'),
    ).toBe(true);
    expect(
      matchesShownAnswer(verse, 'Denn so hat Gott die Welt gelibt.', 'texts'),
    ).toBe(false);
    expect(matchesShownAnswer(verse, 'Denn so hat Gott', 'texts')).toBe(false);
  });
});
