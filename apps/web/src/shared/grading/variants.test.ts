import { describe, expect, it } from 'bun:test';
import { answerVariants } from './variants';

describe('answerVariants', () => {
  it('keeps a plain answer as its only reading', () => {
    expect(answerVariants('die Erinnerung')).toEqual(['die erinnerung']);
  });

  it('treats a parenthesised part as optional', () => {
    expect(answerVariants('to intend (to)')).toEqual([
      'to intend (to)'.toLowerCase(),
      'to intend to',
      'to intend',
    ]);
  });

  it('splits alternatives written inside a word', () => {
    expect(answerVariants('der/die Angestellte')).toEqual([
      'der/die angestellte',
      'der angestellte',
      'die angestellte',
    ]);
  });

  it('splits alternatives written as separate phrases', () => {
    expect(answerVariants('die Straße / der Weg')).toEqual([
      'die straße / der weg',
      'die straße',
      'der weg',
    ]);
  });

  it('combines optional parts with alternatives', () => {
    const variants = answerVariants('to be/get used to (sth.)');

    expect(variants).toContain('to be used to sth');
    expect(variants).toContain('to get used to');
  });

  it('stays bounded for an answer full of alternatives', () => {
    expect(
      answerVariants('a/b c/d e/f g/h i/j k/l m/n').length,
    ).toBeLessThanOrEqual(24);
  });
});
