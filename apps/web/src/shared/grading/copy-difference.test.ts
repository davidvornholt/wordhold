import { describe, expect, it } from 'bun:test';
import { copyDifference, copyDifferenceMessage } from './copy-difference';

const definition =
  'Ein Stoff, der die Aktivierungsenergie einer Reaktion senkt.';

describe('copyDifference', () => {
  it('names the first word that differs, as written in the definition', () => {
    const difference = copyDifference(
      definition,
      'ein Stoff der die Energie einer Reaktion senkt',
    );
    expect(difference).toEqual({
      kind: 'wrong-word',
      position: 5,
      expected: 'Aktivierungsenergie',
      typed: 'Energie',
    });
    expect(copyDifferenceMessage(difference)).toBe(
      'Noch nicht ganz: Das 5. Wort ist „Aktivierungsenergie“, nicht „Energie“.',
    );
  });

  it('shows what is still missing from an unfinished copy', () => {
    expect(
      copyDifference(definition, 'Ein Stoff, der die Aktivierungsenergie'),
    ).toEqual({ kind: 'missing', rest: 'einer Reaktion senkt.' });
  });

  it('shows what was added after the definition ends', () => {
    expect(
      copyDifference(definition, `${definition} Er wird nicht verbraucht.`),
    ).toEqual({ kind: 'extra', rest: 'Er wird nicht verbraucht.' });
  });

  it('ignores case, commas and closing punctuation like grading does', () => {
    expect(
      copyDifference(
        definition,
        'ein stoff der die aktivierungsenergie einer reaktion senkt',
      ),
    ).toBeNull();
  });

  it('shortens a long remainder', () => {
    expect(copyDifference(definition, 'Ein')).toEqual({
      kind: 'missing',
      rest: 'Stoff, der die Aktivierungsenergie einer Reaktion …',
    });
  });
});

describe('copyDifference word boundaries', () => {
  it('treats a comma without a following space as a word boundary', () => {
    expect(copyDifference(definition, 'Ein Stoff,der die Energie')).toEqual({
      kind: 'wrong-word',
      position: 5,
      expected: 'Aktivierungsenergie',
      typed: 'Energie',
    });
  });
});
