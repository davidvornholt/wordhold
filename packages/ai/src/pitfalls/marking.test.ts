import { describe, expect, it } from 'bun:test';
import { readPitfalls } from './marking';
import type { PitfallSuggestion } from './schema';

const pitfall = (
  overrides: Partial<PitfallSuggestion> = {},
): PitfallSuggestion => ({
  word: 'adolescent',
  letters: ['c'],
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
  it('keeps the note with the whole item and its marks', () => {
    expect(
      readPitfalls('gros/grosse', [
        pitfall({ word: 'grosse', letters: ['ss'], misspelling: 'grose' }),
      ]),
    ).toEqual([
      {
        segments: [
          { text: 'gros/gro', tricky: false },
          { text: 'ss', tricky: true },
          { text: 'e', tricky: false },
        ],
        note: 'Das c hört man nicht, wie in adolescence.',
      },
    ]);
  });

  it.each([
    {
      name: 'marks a named pair the misspelling gets wrong whole',
      targetText: 'la moustache',
      suggestion: {
        word: 'moustache',
        letters: ['ou'],
        misspelling: 'mustache',
      },
      expected: 'la m[ou]stache',
    },
    {
      name: 'leaves a named group the misspelling gets right unmarked',
      targetText: 'necessary',
      suggestion: {
        word: 'necessary',
        letters: ['c', 'ss'],
        misspelling: 'neccessary',
      },
      expected: 'ne[c]essary',
    },
    {
      name: 'marks a doubled letter whole',
      targetText: 'embarrassed',
      suggestion: {
        word: 'embarrassed',
        letters: ['rr', 'ss'],
        misspelling: 'embarassed',
      },
      expected: 'emba[rr]assed',
    },
    {
      name: 'marks only the wrong letters of a group longer than a pair',
      targetText: 'Wednesday',
      suggestion: {
        word: 'Wednesday',
        letters: ['Wednesday'],
        misspelling: 'Wensday',
      },
      expected: 'We[d]n[e]sday',
    },
    {
      name: 'marks both letters of a swapped pair',
      targetText: '(to) receive sth.',
      suggestion: { word: 'receive', letters: ['ei'], misspelling: 'recieve' },
      expected: '(to) rec[ei]ve sth.',
    },
    {
      name: 'marks the letter next to an addition',
      targetText: 'la ciencia',
      suggestion: { word: 'ciencia', letters: ['c'], misspelling: 'sciencia' },
      expected: 'la [c]iencia',
    },
    {
      name: 'marks a word of the item that is a phrase',
      targetText: 'under peer pressure',
      suggestion: {
        word: 'peer pressure',
        letters: ['ss'],
        misspelling: 'peer presure',
      },
      expected: 'under peer pre[ss]ure',
    },
    {
      name: 'marks only the word of a phrase the misspelling spells',
      targetText: 'faire plaisir (à qn)',
      suggestion: {
        word: 'faire plaisir',
        letters: ['ai'],
        misspelling: 'plesir',
      },
      expected: 'faire pl[ai]sir (à qn)',
    },
    {
      name: 'marks the word where the item writes it with a capital',
      targetText: 'la Administración y Dirección de Empresas',
      suggestion: {
        word: 'dirección',
        letters: ['cc'],
        misspelling: 'direción',
      },
      expected: 'la Administración y Dire[cc]ión de Empresas',
    },
    {
      name: 'marks the word where the item has it as a whole word',
      targetText: 'mat/e',
      suggestion: { word: 'mat', letters: ['t'], misspelling: 'matt' },
      expected: 'ma[t]/e',
    },
  ])('$name', ({ targetText, suggestion, expected }) => {
    expect(marked(targetText, pitfall(suggestion))).toEqual([expected]);
  });

  it.each([
    'Nach dem e steht sc, obwohl man nur ein s hört.',
    'Vor dem e steht ein stummes c.',
    'Nach dem c folgt kein zweites c.',
    'Nach dem Ton steht sc.',
  ])('keeps a note whose neighbours hold: %s', (note) => {
    expect(marked('adolescent', pitfall({ letters: ['sc'], note }))).toEqual([
      'adole[sc]ent',
    ]);
  });
});

describe('readPitfalls dropping', () => {
  it.each([
    {
      name: 'a word the item does not contain',
      targetText: 'a period of transition',
      suggestions: [
        pitfall({ word: 'transit', letters: ['t'], misspelling: 'transid' }),
      ],
    },
    {
      name: 'a note that repeats the misspelling',
      targetText: 'adolescent',
      suggestions: [pitfall({ note: 'Nicht Adolesent, sondern mit c.' })],
    },
    {
      name: 'a note that is cut off',
      targetText: 'adolescent',
      suggestions: [
        pitfall({ note: 'Das c hört man nicht, nur wenn...' }),
        pitfall({ note: 'Das c hört man nicht, nur wenn…' }),
        pitfall({ note: 'Das c hört man nicht, wie in' }),
      ],
    },
    {
      name: 'a note that names the wrong neighbour',
      targetText: 'adolescent',
      suggestions: [
        pitfall({
          letters: ['sc'],
          note: 'Nach dem l steht sc, obwohl man nur ein s hört.',
        }),
        pitfall({ letters: ['sc'], note: 'Vor dem n steht ein stummes c.' }),
      ],
    },
    {
      name: 'a pitfall its misspelling does not back',
      targetText: 'hostile',
      suggestions: [
        pitfall({ word: 'hostile', letters: ['t'], misspelling: 'hostil' }),
        pitfall({ word: 'hostile', letters: ['e'], misspelling: 'hostile' }),
      ],
    },
    {
      name: 'a pitfall with an empty field',
      targetText: 'adolescent',
      suggestions: [
        pitfall({ misspelling: '' }),
        pitfall({ note: '' }),
        pitfall({ word: '' }),
        pitfall({ letters: [''] }),
      ],
    },
  ])('drops $name', ({ targetText, suggestions }) => {
    expect(readPitfalls(targetText, suggestions)).toEqual([]);
  });
});
