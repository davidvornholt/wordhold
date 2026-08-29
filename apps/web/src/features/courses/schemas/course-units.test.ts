import { describe, expect, it } from 'bun:test';
import { courseTotals, unitOffers } from './course-units';

// A unit part-way through the learning pass, and one that is finished with it.
const mixedEntries = 18;
const mixedUnlearned = 2;
const learnedEntries = 16;
const bothUnits = mixedEntries + learnedEntries;

const unit = (entries: number, unlearned: number) => ({
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Unit 3 – Holidays',
  entries,
  unlearned,
});

describe('unitOffers', () => {
  it('offers both when the unit holds met and unmet entries', () => {
    expect(unitOffers(unit(mixedEntries, mixedUnlearned))).toEqual({
      learn: true,
      drill: true,
    });
  });

  it('offers only learning while no entry has been met', () => {
    expect(unitOffers(unit(learnedEntries, learnedEntries))).toEqual({
      learn: true,
      drill: false,
    });
  });

  it('offers only drilling once every entry has been met', () => {
    expect(unitOffers(unit(learnedEntries, 0))).toEqual({
      learn: false,
      drill: true,
    });
  });

  it('offers nothing for a unit without entries', () => {
    expect(unitOffers(unit(0, 0))).toEqual({ learn: false, drill: false });
  });
});

describe('courseTotals', () => {
  it('sums the units of the course', () => {
    expect(
      courseTotals([
        unit(mixedEntries, mixedUnlearned),
        unit(learnedEntries, 0),
      ]),
    ).toEqual({ entries: bothUnits, unlearned: mixedUnlearned });
  });

  it('reports zero for a course without units', () => {
    expect(courseTotals([])).toEqual({ entries: 0, unlearned: 0 });
  });
});
