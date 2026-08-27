import { describe, expect, it } from 'bun:test';
import { courseTotals, unitOffers } from './course-units';

// A unit part-way through the learning pass, and one that is finished with it.
const mixedWords = 18;
const mixedUnlearned = 2;
const learnedWords = 16;
const bothUnits = mixedWords + learnedWords;

const unit = (words: number, unlearned: number) => ({
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Unit 3 – Holidays',
  words,
  unlearned,
});

describe('unitOffers', () => {
  it('offers both when the unit holds met and unmet words', () => {
    expect(unitOffers(unit(mixedWords, mixedUnlearned))).toEqual({
      learn: true,
      drill: true,
    });
  });

  it('offers only learning while no word has been met', () => {
    expect(unitOffers(unit(learnedWords, learnedWords))).toEqual({
      learn: true,
      drill: false,
    });
  });

  it('offers only drilling once every word has been met', () => {
    expect(unitOffers(unit(learnedWords, 0))).toEqual({
      learn: false,
      drill: true,
    });
  });

  it('offers nothing for a unit without words', () => {
    expect(unitOffers(unit(0, 0))).toEqual({ learn: false, drill: false });
  });
});

describe('courseTotals', () => {
  it('sums the units of the course', () => {
    expect(
      courseTotals([unit(mixedWords, mixedUnlearned), unit(learnedWords, 0)]),
    ).toEqual({ words: bothUnits, unlearned: mixedUnlearned });
  });

  it('reports zero for a course without units', () => {
    expect(courseTotals([])).toEqual({ words: 0, unlearned: 0 });
  });
});
