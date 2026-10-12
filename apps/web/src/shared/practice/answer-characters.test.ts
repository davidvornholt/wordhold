import { describe, expect, it } from 'bun:test';
import { answerCharacters } from './answer-characters';

const characters = (set: ReturnType<typeof answerCharacters>) =>
  set?.groups.flatMap((group) => group.characters) ?? [];

describe('answerCharacters', () => {
  it('offers accents for Spanish and French answers only', () => {
    expect(answerCharacters('language', 'en')).toBeNull();
    expect(answerCharacters('language', 'de')).toBeNull();
    expect(
      characters(answerCharacters('language', 'es')).map((c) => c.character),
    ).toContain('ñ');
    expect(
      characters(answerCharacters('language', 'fr')).map((c) => c.character),
    ).toContain('ç');
  });

  it('offers formulas for a subject and nothing for a text', () => {
    expect(answerCharacters('terms', 'de')?.key).toBe('formulas');
    expect(answerCharacters('texts', 'de')).toBeNull();
  });

  it('names a letter by its base letter and its mark', () => {
    const names = characters(answerCharacters('language', 'fr')).map(
      (c) => c.name,
    );
    expect(names).toContain('c mit Cedille');
    expect(names).toContain('e mit Akut');
    expect(names).toContain('u mit Gravis');
  });
});
