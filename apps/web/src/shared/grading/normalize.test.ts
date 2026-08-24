import { describe, expect, it } from 'bun:test';
import { normalizeAnswer } from './normalize';

describe('normalizeAnswer', () => {
  it('lowercases and trims', () => {
    expect(normalizeAnswer('  The Memory ')).toBe('the memory');
  });

  it('collapses inner whitespace', () => {
    expect(normalizeAnswer('se   souvenir de')).toBe('se souvenir de');
  });

  it('strips trailing sentence punctuation but keeps inner marks', () => {
    expect(normalizeAnswer("Qu'est-ce que c'est ?")).toBe(
      "qu'est-ce que c'est",
    );
  });

  it('strips leading Spanish inverted marks', () => {
    expect(normalizeAnswer('¿Cómo estás?')).toBe('cómo estás');
  });

  it('unifies typographic apostrophes and drops quotes', () => {
    expect(normalizeAnswer('l’école')).toBe("l'école");
    expect(normalizeAnswer('„hello“')).toBe('hello');
  });

  it('keeps accents intact', () => {
    expect(normalizeAnswer('École')).toBe('école');
  });
});
