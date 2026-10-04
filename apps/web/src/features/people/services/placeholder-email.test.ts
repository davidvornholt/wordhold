import { describe, expect, it } from 'bun:test';
import { placeholderEmail } from './placeholder-email';

const userId = '7c1e2f3a-0000-4000-8000-000000000000';

describe('placeholderEmail', () => {
  it('spells the name in plain letters', () => {
    expect(placeholderEmail('Jürgen Weiß', userId)).toBe(
      'juergen-weiss.7c1e2f@wordhold.invalid',
    );
  });

  it('drops accents and punctuation', () => {
    expect(placeholderEmail('  Zoëy (Oma)!', userId)).toBe(
      'zoey-oma.7c1e2f@wordhold.invalid',
    );
  });

  it('falls back when no letter is left', () => {
    expect(placeholderEmail('李', userId)).toBe(
      'person.7c1e2f@wordhold.invalid',
    );
  });
});
