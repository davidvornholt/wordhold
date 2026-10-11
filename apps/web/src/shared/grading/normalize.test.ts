import { describe, expect, it } from 'bun:test';
import { normalizeAnswer, normalizeAnswerForComparison } from './normalize';

describe('normalizeAnswer', () => {
  it('lowercases and trims', () => {
    expect(normalizeAnswer('  The Memory ')).toBe('the memory');
  });

  it('keeps the indices and charges of a formula', () => {
    expect(normalizeAnswer('SO₄²⁻')).toBe('so₄²⁻');
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

describe('normalizeAnswerForComparison', () => {
  it('treats inner commas and their surrounding whitespace as spacing', () => {
    expect(normalizeAnswerForComparison('hello,world')).toBe('hello world');
    expect(normalizeAnswerForComparison('hello ,  world')).toBe('hello world');
  });

  it('ignores spacing around a slash', () => {
    for (const text of ['el/la tenista', 'el / la tenista', 'el/ la tenista']) {
      expect(normalizeAnswerForComparison(text)).toBe('el/la tenista');
    }
  });

  it('reads typed arrows as the printed ones, with any spacing', () => {
    for (const text of ['(o → ue)', '(o -> ue)', '(o->ue)', '(o  →ue)']) {
      expect(normalizeAnswerForComparison(text)).toBe('(o → ue)');
    }
    expect(normalizeAnswerForComparison('a <- b')).toBe('a ← b');
    expect(normalizeAnswerForComparison('a <-> b')).toBe('a ↔ b');
    expect(normalizeAnswerForComparison('a => b')).toBe('a ⇒ b');
  });

  it('reads three dots as an ellipsis and dashes as hyphens', () => {
    expect(normalizeAnswerForComparison('no … nada')).toBe(
      normalizeAnswerForComparison('no...nada'),
    );
    expect(normalizeAnswerForComparison('algo…')).toBe('algo');
    expect(normalizeAnswerForComparison('ir – fui')).toBe('ir - fui');
    expect(normalizeAnswerForComparison('ir — fui')).toBe('ir - fui');
  });

  it('keeps case, which is part of the spelling', () => {
    expect(normalizeAnswerForComparison('  der Weg. ')).toBe('der Weg');
    expect(normalizeAnswerForComparison('CO')).not.toBe(
      normalizeAnswerForComparison('Co'),
    );
  });

  it('reads a minus sign as a hyphen', () => {
    expect(normalizeAnswerForComparison('pH − Wert')).toBe('pH - Wert');
  });

  it('keeps textbook notation for the variant parser', () => {
    expect(normalizeAnswerForComparison('amigo/a; estudiante(s)')).toBe(
      'amigo/a; estudiante(s)',
    );
  });
});
