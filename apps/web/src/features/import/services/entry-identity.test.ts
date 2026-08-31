import { describe, expect, it } from 'bun:test';
import {
  comparableEntryText,
  duplicateVerdict,
  entryIdentityKey,
} from './entry-identity';

const stored = (targetText: string, examples: ReadonlyArray<string> = []) => ({
  targetText,
  examples,
});

describe('comparableEntryText', () => {
  it.each([
    ['der Hund / die Hunde', 'der Hund die Hunde'],
    ['to set off!', 'to set off'],
    ['aller;   retour', 'aller retour'],
    ['  mémoire.  ', 'mémoire'],
    ['ﬁnden', 'finden'],
  ])('ignores punctuation, symbols, and spacing in %j', (raw, comparable) => {
    expect(comparableEntryText(raw)).toBe(comparable);
  });

  it('preserves casing so a deliberate difference stays visible', () => {
    expect(comparableEntryText('Sie?')).toBe('Sie');
    expect(entryIdentityKey('Sie?')).toBe('sie');
  });
});

describe('duplicateVerdict', () => {
  const draft = (targetText: string, example = '') => ({
    targetText,
    example,
  });

  it('reports no duplicate for a new word or a blank draft', () => {
    expect(duplicateVerdict(draft('chien'), [stored('chat')])).toBe('none');
    expect(duplicateVerdict(draft('...'), [stored('chat')])).toBe('none');
  });

  it('blocks the same word with the same casing and no example on either side', () => {
    expect(duplicateVerdict(draft('mémoire'), [stored('mémoire')])).toBe(
      'exact',
    );
  });

  it('blocks a re-scan that differs only in punctuation or spacing', () => {
    expect(duplicateVerdict(draft('mémoire!!'), [stored(' mémoire ')])).toBe(
      'exact',
    );
  });

  it('allows an exception when the casing differs', () => {
    expect(duplicateVerdict(draft('Sie'), [stored('sie')])).toBe('exception');
  });

  it('allows an exception when the example sentence differs', () => {
    expect(
      duplicateVerdict(draft('mémoire', 'Une bonne mémoire.'), [
        stored('mémoire', ['La mémoire humaine.']),
      ]),
    ).toBe('exception');
    expect(
      duplicateVerdict(draft('mémoire'), [
        stored('mémoire', ['La mémoire humaine.']),
      ]),
    ).toBe('exception');
  });

  it('blocks a draft whose example matches one of several stored examples', () => {
    expect(
      duplicateVerdict(draft('mémoire', 'La mémoire humaine!'), [
        stored('mémoire', ['Une bonne mémoire.', 'La mémoire humaine.']),
      ]),
    ).toBe('exact');
  });

  it('blocks when any stored twin matches exactly, despite another variant', () => {
    expect(duplicateVerdict(draft('sie'), [stored('Sie'), stored('sie')])).toBe(
      'exact',
    );
  });
});
