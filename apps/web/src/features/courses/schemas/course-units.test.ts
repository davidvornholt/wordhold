import { describe, expect, it } from 'bun:test';
import { courseTotals, unitOffers } from './course-units';

// A unit part-way through the learning pass, and one that is finished with it.
const mixedEntries = 18;
const mixedUnintroduced = 2;
const introducedEntries = 16;
const bothUnits = mixedEntries + introducedEntries;

const unit = (entries: number, unintroduced: number) => ({
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Unit 3 – Holidays',
  entries,
  unintroduced,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
});

describe('unitOffers', () => {
  it('offers both when the unit holds met and unmet entries', () => {
    expect(unitOffers(unit(mixedEntries, mixedUnintroduced))).toEqual({
      learn: true,
      practice: true,
    });
  });

  it('offers only learning while no entry has been met', () => {
    expect(unitOffers(unit(introducedEntries, introducedEntries))).toEqual({
      learn: true,
      practice: false,
    });
  });

  it('offers only practice once every entry has been met', () => {
    expect(unitOffers(unit(introducedEntries, 0))).toEqual({
      learn: false,
      practice: true,
    });
  });

  it('offers nothing for a unit without entries', () => {
    expect(unitOffers(unit(0, 0))).toEqual({ learn: false, practice: false });
  });
});

describe('courseTotals', () => {
  it('sums the units of the course', () => {
    expect(
      courseTotals([
        unit(mixedEntries, mixedUnintroduced),
        unit(introducedEntries, 0),
      ]),
    ).toEqual({ entries: bothUnits, unintroduced: mixedUnintroduced });
  });

  it('reports zero for a course without units', () => {
    expect(courseTotals([])).toEqual({ entries: 0, unintroduced: 0 });
  });
});
