import { describe, expect, it } from 'bun:test';
import type { AcceptedAnswer } from './deterministic-grading';
import { isDeterministicMatch } from './deterministic-grading';

const answer = (
  text: string,
  source: AcceptedAnswer['source'] = 'textbook',
): AcceptedAnswer => ({ text, source });

describe('isDeterministicMatch', () => {
  it('accepts every supported textbook reading', () => {
    expect(isDeterministicMatch('étudiante', [answer('étudiant(e)')])).toBe(
      true,
    );
    expect(
      isDeterministicMatch('der Weg', [answer('die Straße/der Weg')]),
    ).toBe(true);
    expect(isDeterministicMatch('amiga', [answer('amigo/a')])).toBe(true);
    expect(isDeterministicMatch('profesora', [answer('profesor/a')])).toBe(
      true,
    );
    expect(isDeterministicMatch('doctora', [answer('doctor/a')])).toBe(true);
    expect(isDeterministicMatch('actrice', [answer('acteur/trice')])).toBe(
      true,
    );
    expect(isDeterministicMatch('sportive', [answer('sportif/ive')])).toBe(
      true,
    );
    expect(
      isDeterministicMatch('Verkehrssprache', [
        answer('lingua franca; Verkehrssprache'),
      ]),
    ).toBe(true);
  });

  it('ignores commas and spacing around textbook separators', () => {
    expect(isDeterministicMatch('hello world', [answer('hello, world')])).toBe(
      true,
    );
    expect(isDeterministicMatch('hello,world', [answer('hello world')])).toBe(
      true,
    );
    expect(isDeterministicMatch('amiga', [answer('amigo / a')])).toBe(true);
    expect(isDeterministicMatch('a', [answer('amigo / a')])).toBe(false);
    expect(isDeterministicMatch('bonne', [answer('bon/ bonne')])).toBe(true);
  });

  it('rejects compact suffix fragments and invented forms', () => {
    expect(isDeterministicMatch('trice', [answer('acteur/trice')])).toBe(false);
    expect(isDeterministicMatch('ive', [answer('sportif/ive')])).toBe(false);
    expect(isDeterministicMatch('euse', [answer('heureux/euse')])).toBe(false);
    expect(isDeterministicMatch('onne', [answer('bon/onne')])).toBe(false);
    expect(isDeterministicMatch('profesoa', [answer('profesor/a')])).toBe(
      false,
    );
    expect(isDeterministicMatch('doctoa', [answer('doctor/a')])).toBe(false);
  });

  it('requires every branch in a submitted alternative to be accepted', () => {
    expect(isDeterministicMatch('correct / wrong', [answer('correct')])).toBe(
      false,
    );
    expect(
      isDeterministicMatch('correct / right', [
        answer('correct'),
        answer('right'),
      ]),
    ).toBe(true);
    expect(
      isDeterministicMatch('to intend (wrong)', [answer('to intend (to)')]),
    ).toBe(false);
    expect(
      isDeterministicMatch('acteur/trice', [
        answer('acteur'),
        answer('actrice'),
      ]),
    ).toBe(true);
    expect(
      isDeterministicMatch('acteur/trice', [answer('acteur'), answer('trice')]),
    ).toBe(false);
  });

  it('does not reinterpret judge or manual answers as textbook notation', () => {
    expect(isDeterministicMatch('yes', [answer('yes/no', 'judge')])).toBe(
      false,
    );
    expect(
      isDeterministicMatch('to intend', [answer('to intend (to)', 'manual')]),
    ).toBe(false);
    expect(isDeterministicMatch('yes/no', [answer('yes/no', 'judge')])).toBe(
      true,
    );
  });

  it('sends an unenumerated overflow reading to the judge', () => {
    expect(
      isDeterministicMatch('bb dd ff hh jj', [
        answer('aa/bb cc/dd ee/ff gg/hh ii/jj'),
      ]),
    ).toBe(false);
  });
});

describe('isDeterministicMatch dictionary notation regressions', () => {
  it.each([
    ['el abogado', 'el/la abogado/-a'],
    ['la abogada', 'el/la abogado/-a'],
    ['el abogado/la abogada', 'el/la abogado/-a'],
    ['el abogado /la abogada', 'el/la abogado/-a'],
    ['el abogado/ la abogada', 'el/la abogado/-a'],
    ['el abogado / la abogada', 'el/la abogado/-a'],
    ['determinada', 'determinado/-a'],
    ['determinado', 'determinado/-a'],
    ['el programa', 'el programa m.'],
    ['ask for directions', 'to ask for directions'],
    ['obtener algo', 'obtener algo (e → ie)'],
    ['AC/DC', 'AC/DC'],
  ])('accepts %s for %s', (submitted, expected) => {
    expect(isDeterministicMatch(submitted, [answer(expected)])).toBe(true);
  });

  it.each([
    ['la abogado', 'el/la abogado/a'],
    ['el abogada', 'el/la abogado/-a'],
    ['el abogado / la abogado', 'el/la abogado/-a'],
    ['la abogado/el abogada', 'el/la abogado/-a'],
    ['a', 'determinado/-a'],
    ['programa', 'el programa m.'],
    ['el programa f.', 'el programa m.'],
    ['ask directions', 'to ask for directions'],
    ['ask for directions (wrong)', 'to ask for directions'],
    ['obtener algo (como tener)', 'obtener algo (e → ie)'],
    ['eine Angestellter', 'eine/ein Angestellte(r)'],
    ['ein Angestellte', 'eine/ein Angestellte(r)'],
    ['AC', 'AC/DC'],
    ['DC', 'AC/DC'],
  ])('sends %s for %s to the judge', (submitted, expected) => {
    expect(isDeterministicMatch(submitted, [answer(expected)])).toBe(false);
  });

  it.each(['judge', 'manual'] as const)(
    'does not infer dictionary omissions from %s answers',
    (source) => {
      expect(
        isDeterministicMatch('ask for directions', [
          answer('to ask for directions', source),
        ]),
      ).toBe(false);
      expect(
        isDeterministicMatch('el programa', [answer('el programa m.', source)]),
      ).toBe(false);
      expect(
        isDeterministicMatch('la abogada', [
          answer('el/la abogado/-a', source),
        ]),
      ).toBe(false);
    },
  );
});
