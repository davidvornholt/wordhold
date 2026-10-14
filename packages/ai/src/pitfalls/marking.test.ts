import { describe, expect, it } from 'bun:test';
import { readPitfalls } from './marking';
import type { PitfallSuggestion } from './schema';

const pitfall = (
  overrides: Partial<PitfallSuggestion> = {},
): PitfallSuggestion => ({
  word: 'adolescent',
  letters: ['sc'],
  misspelling: 'adolesent',
  note: 'Das c hört man nicht, wie in adolescence.',
  ...overrides,
});

// The marked spelling in the bracket notation the tests read most easily.
const marked = (targetText: string, suggestion: PitfallSuggestion) =>
  readPitfalls(targetText, [suggestion]).map((kept) =>
    kept.segments
      .map((segment) => (segment.tricky ? `[${segment.text}]` : segment.text))
      .join(''),
  );

describe('readPitfalls marking', () => {
  it('keeps the note with the marked spelling', () => {
    expect(readPitfalls('adolescent', [pitfall()])).toEqual([
      {
        segments: [
          { text: 'adoles', tricky: false },
          { text: 'c', tricky: true },
          { text: 'ent', tricky: false },
        ],
        note: 'Das c hört man nicht, wie in adolescence.',
      },
    ]);
  });

  it('marks only the named letters the misspelling gets wrong', () => {
    expect(
      marked('adolescent', pitfall({ misspelling: 'adolessent' })),
    ).toEqual(['adoles[c]ent']);
    expect(
      marked(
        'necessary',
        pitfall({
          word: 'necessary',
          letters: ['ce', 'ss'],
          misspelling: 'neccessary',
        }),
      ),
    ).toEqual(['ne[c]essary']);
    expect(
      marked(
        'atrás',
        pitfall({ word: 'atrás', letters: ['á'], misspelling: 'atras' }),
      ),
    ).toEqual(['atr[á]s']);
  });

  it('marks a doubled letter whole', () => {
    expect(
      marked(
        'embarrassed',
        pitfall({
          word: 'embarrassed',
          letters: ['rr', 'ss'],
          misspelling: 'embarassed',
        }),
      ),
    ).toEqual(['emba[rr]assed']);
  });

  it('marks separate mistakes separately', () => {
    expect(
      marked(
        'Wednesday',
        pitfall({
          word: 'Wednesday',
          letters: ['Wed', 'nes'],
          misspelling: 'Wensday',
        }),
      ),
    ).toEqual(['We[d]n[e]sday']);
  });

  it('marks both letters of a swapped pair', () => {
    expect(
      marked(
        '(to) receive sth.',
        pitfall({ word: 'receive', letters: ['ei'], misspelling: 'recieve' }),
      ),
    ).toEqual(['rec[ei]ve']);
  });

  it('marks the letter next to an addition that leaves no named letter wrong', () => {
    expect(
      marked(
        'la ciencia',
        pitfall({ word: 'ciencia', letters: ['ci'], misspelling: 'sciencia' }),
      ),
    ).toEqual(['[c]iencia']);
  });

  it('shows only the marked word of a phrase', () => {
    expect(
      marked(
        'peer pressure',
        pitfall({
          word: 'peer pressure',
          letters: ['ss'],
          misspelling: 'peer presure',
        }),
      ),
    ).toEqual(['pre[ss]ure']);
  });
});

describe('readPitfalls dropping', () => {
  it('drops a pitfall in a word the item does not contain', () => {
    expect(
      readPitfalls('a period of transition', [
        pitfall({ word: 'transit', letters: ['t'], misspelling: 'transid' }),
      ]),
    ).toEqual([]);
  });

  it('drops a note that repeats the misspelling', () => {
    expect(
      readPitfalls('adolescent', [
        pitfall({ note: 'Nicht Adolesent, sondern mit c.' }),
      ]),
    ).toEqual([]);
  });

  it('drops a pitfall its misspelling does not back', () => {
    expect(
      readPitfalls('hostile', [
        pitfall({ word: 'hostile', letters: ['t'], misspelling: 'hostil' }),
      ]),
    ).toEqual([]);
    expect(
      readPitfalls('adolescent', [pitfall({ misspelling: 'adolescent' })]),
    ).toEqual([]);
  });

  it('drops a pitfall with an empty field', () => {
    expect(
      readPitfalls('adolescent', [
        pitfall({ misspelling: '' }),
        pitfall({ note: '' }),
        pitfall({ word: '' }),
        pitfall({ letters: [''] }),
      ]),
    ).toEqual([]);
  });
});
