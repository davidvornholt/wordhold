import { describe, expect, it } from 'bun:test';
import { answerVariants } from './variants';

const adversarialOptionalGroupCount = 20;
const strictParserTimeoutMs = 50;

describe('answerVariants', () => {
  it('keeps a plain answer as its only reading', () => {
    expect(answerVariants('die Erinnerung')).toEqual({
      _tag: 'Expanded',
      readings: ['die erinnerung'],
    });
  });

  it('expands spaced optional words without detaching inline affixes', () => {
    expect(answerVariants('to intend (to)')).toEqual({
      _tag: 'Expanded',
      readings: ['to intend to', 'to intend'],
    });
    expect(answerVariants('étudiant(e)')).toEqual({
      _tag: 'Expanded',
      readings: ['étudiante', 'étudiant'],
    });
    expect(answerVariants('ein(e)')).toEqual({
      _tag: 'Expanded',
      readings: ['eine', 'ein'],
    });
  });

  it('expands complete word alternatives and suffix shorthand', () => {
    expect(answerVariants('der/die Angestellte')).toEqual({
      _tag: 'Expanded',
      readings: ['der angestellte', 'die angestellte'],
    });
    expect(answerVariants('amigo/a')).toEqual({
      _tag: 'Expanded',
      readings: ['amigo', 'amiga'],
    });
    expect(answerVariants('profesor/a')).toEqual({
      _tag: 'Expanded',
      readings: ['profesor', 'profesora'],
    });
    expect(answerVariants('doctor/a')).toEqual({
      _tag: 'Expanded',
      readings: ['doctor', 'doctora'],
    });
    expect(answerVariants('acteur/trice')).toEqual({
      _tag: 'Expanded',
      readings: ['acteur', 'actrice'],
    });
    expect(answerVariants('sportif/ive')).toEqual({
      _tag: 'Expanded',
      readings: ['sportif', 'sportive'],
    });
  });
});

describe('answerVariants punctuation and separators', () => {
  it('ignores spacing around registered compact slash notation', () => {
    for (const notation of ['amigo/a', 'amigo /a', 'amigo/ a', 'amigo / a']) {
      expect(answerVariants(notation)).toEqual({
        _tag: 'Expanded',
        readings: ['amigo', 'amiga'],
      });
    }
    expect(answerVariants('der / die Angestellte')).toEqual({
      _tag: 'Expanded',
      readings: ['der angestellte', 'die angestellte'],
    });
  });

  it('expands explicit and conservative compact phrase alternatives', () => {
    for (const notation of [
      'die Straße/der Weg',
      'die Straße /der Weg',
      'die Straße/ der Weg',
      'die Straße / der Weg',
    ]) {
      expect(answerVariants(notation)).toEqual({
        _tag: 'Expanded',
        readings: ['die straße', 'der weg'],
      });
    }
  });

  it('keeps literal slash names whole', () => {
    expect(answerVariants('AC/DC')).toEqual({
      _tag: 'Expanded',
      readings: ['ac/dc'],
    });
  });

  it('does not detach an unregistered multi-character suffix', () => {
    expect(answerVariants('heureux/euse')).toEqual({ _tag: 'Overflow' });
    expect(answerVariants('vendeur/euse')).toEqual({ _tag: 'Overflow' });
    expect(answerVariants('bon/onne')).toEqual({ _tag: 'Overflow' });
  });

  it('expands complete alternatives when the separator makes them explicit', () => {
    for (const notation of ['bon / bonne', 'bon /bonne', 'bon/ bonne']) {
      expect(answerVariants(notation)).toEqual({
        _tag: 'Expanded',
        readings: ['bon', 'bonne'],
      });
    }
  });

  it('keeps a multiword explicit alternative after a compact-looking prefix', () => {
    expect(answerVariants('camino / a pie')).toEqual({
      _tag: 'Expanded',
      readings: ['camino', 'a pie'],
    });
  });

  it('combines semicolon and slash-separated phrase alternatives', () => {
    expect(answerVariants('correct / right; accurate;')).toEqual({
      _tag: 'Expanded',
      readings: ['correct', 'right', 'accurate'],
    });
  });

  it('ignores commas within a reading', () => {
    expect(answerVariants('hello, world')).toEqual({
      _tag: 'Expanded',
      readings: ['hello world'],
    });
  });
});

describe('answerVariants combinations and bounds', () => {
  it('expands each non-empty semicolon-separated textbook answer', () => {
    expect(answerVariants('lingua franca; Verkehrssprache')).toEqual({
      _tag: 'Expanded',
      readings: ['lingua franca', 'verkehrssprache'],
    });
    expect(answerVariants('to intend (to); plan to')).toEqual({
      _tag: 'Expanded',
      readings: ['to intend to', 'to intend', 'plan to'],
    });
    expect(answerVariants('keep;')).toEqual({
      _tag: 'Expanded',
      readings: ['keep'],
    });
  });

  it('combines optional parts with alternatives', () => {
    expect(answerVariants('to be/get used to (sth.)')).toEqual({
      _tag: 'Expanded',
      readings: [
        'to be used to sth',
        'to get used to sth',
        'to be used to',
        'to get used to',
      ],
    });
  });

  it(
    'reports overflow before expanding twenty optional groups',
    () => {
      expect(
        answerVariants('root (a)'.repeat(adversarialOptionalGroupCount)),
      ).toEqual({
        _tag: 'Overflow',
      });
    },
    strictParserTimeoutMs,
  );

  it('reports slash combinations that exceed the reading limit', () => {
    expect(answerVariants('aa/bb cc/dd ee/ff gg/hh ii/jj')).toEqual({
      _tag: 'Overflow',
    });
  });
});
