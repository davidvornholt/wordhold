import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { deriveRating, isCorrect, ratings } from './rating';

const fastMs = 3000;
const slowMs = 12_000;

const verdict = (overrides: Partial<JudgeVerdictData>): JudgeVerdictData => ({
  correct: true,
  acceptAsAlternative: false,
  meaning: { ok: true, note: null },
  grammar: { ok: true, note: null },
  idiomaticity: { ok: true, note: null },
  spelling: { ok: true, note: null },
  intendedConstruction: { ok: true, note: null },
  explanation: 'Passt.',
  ...overrides,
});

describe('deriveRating', () => {
  it('rates a fast exact match Easy', () => {
    expect(deriveRating({ method: 'exact' }, fastMs)).toBe(ratings.easy);
  });

  it('rates a slow exact match Good', () => {
    expect(deriveRating({ method: 'exact' }, slowMs)).toBe(ratings.good);
  });

  it('rates an exact match without timing Good', () => {
    expect(deriveRating({ method: 'exact' }, null)).toBe(ratings.good);
  });

  it('rates a flawless judge acceptance Good', () => {
    expect(
      deriveRating({ method: 'judge', verdict: verdict({}) }, fastMs),
    ).toBe(ratings.good);
  });

  it('rates a flawed but accepted answer Hard', () => {
    const flawed = verdict({ spelling: { ok: false, note: 'Tippfehler' } });
    expect(deriveRating({ method: 'judge', verdict: flawed }, fastMs)).toBe(
      ratings.hard,
    );
  });

  it('rates a rejected answer Again', () => {
    const wrong = verdict({
      correct: false,
      meaning: { ok: false, note: null },
    });
    expect(deriveRating({ method: 'judge', verdict: wrong }, fastMs)).toBe(
      ratings.again,
    );
  });
});

describe('isCorrect', () => {
  it('treats exact matches as correct', () => {
    expect(isCorrect({ method: 'exact' })).toBe(true);
  });

  it('follows the judge verdict otherwise', () => {
    expect(
      isCorrect({ method: 'judge', verdict: verdict({ correct: false }) }),
    ).toBe(false);
  });
});
