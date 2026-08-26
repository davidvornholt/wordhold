import { describe, expect, it } from 'bun:test';
import type { AcceptedAnswer } from './deterministic-grading';
import { isDeterministicMatch } from './deterministic-grading';

const answer = (
  text: string,
  source: AcceptedAnswer['source'] = 'textbook',
): AcceptedAnswer => ({ text, normalized: text.toLowerCase(), source });

describe('isDeterministicMatch', () => {
  it('accepts every supported textbook reading', () => {
    expect(isDeterministicMatch('étudiante', [answer('étudiant(e)')])).toBe(
      true,
    );
    expect(
      isDeterministicMatch('der Weg', [answer('die Straße/der Weg')]),
    ).toBe(true);
    expect(isDeterministicMatch('amiga', [answer('amigo/a')])).toBe(true);
    expect(isDeterministicMatch('actrice', [answer('acteur/trice')])).toBe(
      true,
    );
    expect(isDeterministicMatch('sportive', [answer('sportif/ive')])).toBe(
      true,
    );
  });

  it('rejects compact suffix fragments as standalone answers', () => {
    expect(isDeterministicMatch('trice', [answer('acteur/trice')])).toBe(false);
    expect(isDeterministicMatch('ive', [answer('sportif/ive')])).toBe(false);
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
