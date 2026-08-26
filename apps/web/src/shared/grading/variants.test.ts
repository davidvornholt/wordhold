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
  });

  it('expands explicit and conservative compact phrase alternatives', () => {
    expect(answerVariants('die Straße / der Weg')).toEqual({
      _tag: 'Expanded',
      readings: ['die straße', 'der weg'],
    });
    expect(answerVariants('die Straße/der Weg')).toEqual({
      _tag: 'Expanded',
      readings: ['die straße', 'der weg'],
    });
  });

  it('keeps literal slash names whole', () => {
    expect(answerVariants('AC/DC')).toEqual({
      _tag: 'Expanded',
      readings: ['ac/dc'],
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
