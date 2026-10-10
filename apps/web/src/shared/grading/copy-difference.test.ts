import { describe, expect, it } from 'bun:test';
import { copyDifference, copyDifferenceMessage } from './copy-difference';

const definition =
  'Ein Stoff, der die Aktivierungsenergie einer Reaktion senkt.';

describe('copyDifference', () => {
  it('names the first word that differs, as written in the definition', () => {
    const difference = copyDifference(
      definition,
      'Ein Stoff der die Energie einer Reaktion senkt',
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

  it('ignores commas and closing punctuation like grading does', () => {
    expect(
      copyDifference(
        definition,
        'Ein Stoff der die Aktivierungsenergie einer Reaktion senkt',
      ),
    ).toBeNull();
  });

  it('names a word written in the wrong case', () => {
    expect(
      copyDifference(definition, 'Ein stoff, der die Aktivierungsenergie'),
    ).toEqual({
      kind: 'wrong-word',
      position: 2,
      expected: 'Stoff,',
      typed: 'stoff,',
    });
  });

  it('accepts the indices of a formula typed on the line', () => {
    const acid = 'Eine Säure mit der Formel H₂SO₄.';
    expect(copyDifference(acid, 'Eine Säure mit der Formel H2SO4.')).toBeNull();
    expect(copyDifference(acid, 'Eine Säure mit der Formel H²SO₄.')).toEqual({
      kind: 'wrong-word',
      position: 6,
      expected: 'H₂SO₄.',
      typed: 'H²SO₄.',
    });
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

  it('keeps a decimal comma inside its number', () => {
    expect(
      copyDifference(
        'Eine Lösung mit dem pH-Wert 7,0 ist neutral.',
        'Eine Lösung mit dem pH-Wert 7,0 ist sauer.',
      ),
    ).toEqual({
      kind: 'wrong-word',
      position: 8,
      expected: 'neutral.',
      typed: 'sauer.',
    });
  });
});

describe('copyDifference between sentences', () => {
  const twoSentences =
    'Ein Stoff, der Reaktionen beschleunigt. Er bleibt erhalten.';

  it('names a missing full stop between two sentences', () => {
    expect(
      copyDifference(
        twoSentences,
        'Ein Stoff, der Reaktionen beschleunigt, er bleibt erhalten.',
      ),
    ).toEqual({
      kind: 'wrong-word',
      position: 5,
      expected: 'beschleunigt.',
      typed: 'beschleunigt,',
    });
  });

  it('treats the last typed word as where an unfinished copy stops', () => {
    expect(
      copyDifference(twoSentences, 'Ein Stoff, der Reaktionen beschleunigt'),
    ).toEqual({ kind: 'missing', rest: 'Er bleibt erhalten.' });
  });
});
