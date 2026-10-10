import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import { maximumEntryTextLength } from '../extraction/schema';
import { definitionJudgePrompt } from './judge';
import {
  DefinitionSuggestion,
  DefinitionVerdict,
  isDefinitionCorrect,
  KeyPointList,
  maximumKeyPointLength,
  maximumKeyPoints,
} from './schema';
import { definitionPrompt, keyPointPrompt } from './writer';

const catalyst = {
  term: 'Katalysator',
  definition:
    'Stoff, der die Aktivierungsenergie einer Reaktion senkt und sie so beschleunigt, ohne dabei verbraucht zu werden.',
  keyPoints: [
    'senkt die Aktivierungsenergie',
    'beschleunigt die Reaktion',
    'wird nicht verbraucht',
  ],
} as const;

const representativePromptCharacterBudget = 1500;

describe('definitionJudgePrompt', () => {
  it('sends the term, the reference, every key point and the answer as data', () => {
    const prompt = definitionJudgePrompt({
      ...catalyst,
      givenAnswer: 'beschleunigt Reaktionen und wird nicht verbraucht',
    });
    expect(prompt).toContain('"term":"Katalysator"');
    expect(prompt).toContain(
      '"keyPoints":["senkt die Aktivierungsenergie","beschleunigt die Reaktion","wird nicht verbraucht"]',
    );
    expect(prompt).toContain(
      '"answer":"beschleunigt Reaktionen und wird nicht verbraucht"',
    );
    expect(prompt.length).toBeLessThan(representativePromptCharacterBudget);
  });

  it('takes formulas and symbols as written, indices on the line aside', () => {
    expect(definitionJudgePrompt({ ...catalyst, givenAnswer: '' })).toContain(
      'except in formulas and symbols (CO is not Co, but H2O may mean H₂O)',
    );
  });

  it('requires the technical terms of a key point', () => {
    expect(definitionJudgePrompt({ ...catalyst, givenAnswer: '' })).toContain(
      'covered only by that term or an exact synonym',
    );
  });

  // The feedback heading already says the answer was right.
  it('asks for no explanation when nothing is missing or wrong', () => {
    expect(definitionJudgePrompt({ ...catalyst, givenAnswer: '' })).toContain(
      'otherwise use a null explanation',
    );
  });
});

describe('DefinitionVerdict', () => {
  const verdict = (
    covered: ReadonlyArray<boolean>,
    accurate: boolean,
  ): unknown => ({
    keyPoints: covered.map((point) => ({
      covered: point,
      note: point ? null : 'fehlt',
    })),
    accuracy: { ok: accurate, note: accurate ? null : 'falsch' },
    explanation: null,
  });
  const decode = Schema.decodeUnknownSync(DefinitionVerdict);

  it('counts a definition as correct only when every point is covered and nothing is false', () => {
    expect(isDefinitionCorrect(decode(verdict([true, true, true], true)))).toBe(
      true,
    );
    expect(
      isDefinitionCorrect(decode(verdict([false, true, true], true))),
    ).toBe(false);
    expect(
      isDefinitionCorrect(decode(verdict([true, true, true], false))),
    ).toBe(false);
  });
});

describe('key points', () => {
  const decode = Schema.decodeUnknownSync(KeyPointList);

  it('asks for a bounded list that keeps the technical terms', () => {
    const prompt = keyPointPrompt(catalyst);
    expect(prompt).toContain(`1 to ${maximumKeyPoints}`);
    expect(prompt).toContain('technical terms verbatim');
    expect(prompt).toContain(`"definition":"${catalyst.definition}"`);
  });

  it('trims the points and rejects an empty, overlong or oversized list', () => {
    expect(decode({ keyPoints: ['  wird nicht verbraucht  '] })).toEqual({
      keyPoints: ['wird nicht verbraucht'],
    });
    expect(() => decode({ keyPoints: [] })).toThrow();
    expect(() => decode({ keyPoints: [' '] })).toThrow();
    expect(() =>
      decode({ keyPoints: ['x'.repeat(maximumKeyPointLength + 1)] }),
    ).toThrow();
    expect(() =>
      decode({
        keyPoints: Array.from(
          { length: maximumKeyPoints + 1 },
          (_, index) => `Punkt ${index}`,
        ),
      }),
    ).toThrow();
  });
});

describe('definition suggestion', () => {
  it('names the term and its subject', () => {
    const prompt = definitionPrompt({ term: 'Base', subject: 'Chemie' });
    expect(prompt).toContain('"Base"');
    expect(prompt).toContain('"Chemie"');
  });

  it('asks for formulas in sub- and superscript characters', () => {
    expect(definitionPrompt({ term: 'Sulfat', subject: 'Chemie' })).toContain(
      'like H₂O or SO₄²⁻',
    );
  });

  it('trims the suggestion and keeps it within an entry', () => {
    const decode = Schema.decodeUnknownSync(DefinitionSuggestion);
    expect(decode({ definition: ' Stoff, der Protonen aufnimmt. ' })).toEqual({
      definition: 'Stoff, der Protonen aufnimmt.',
    });
    expect(() => decode({ definition: ' ' })).toThrow();
    expect(() =>
      decode({ definition: 'x'.repeat(maximumEntryTextLength + 1) }),
    ).toThrow();
  });
});
