import { describe, expect, it } from 'bun:test';
import type { UnitDirectionProgress } from './course-units';
import { courseTotals, recommendedUnitAction } from './course-units';

// A unit part-way through the learning pass, and one that is finished with it.
const mixedEntries = 18;
const mixedUnintroduced = 2;
const introducedEntries = 16;
const bothUnits = mixedEntries + introducedEntries;

const progress = (
  direction: UnitDirectionProgress['direction'],
  overrides: Partial<UnitDirectionProgress>,
): UnitDirectionProgress => ({
  direction,
  total: mixedEntries,
  introduced: 0,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  ...overrides,
});

const unit = (entries: number, introduced: number, unintroduced: number) => ({
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Unit 3 – Holidays',
  entries,
  introduced,
  unintroduced,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  directions: [],
});

describe('courseTotals', () => {
  it('sums the units of the course', () => {
    expect(
      courseTotals([
        unit(mixedEntries, introducedEntries, mixedUnintroduced),
        unit(introducedEntries, introducedEntries, 0),
      ]),
    ).toEqual({ entries: bothUnits, unintroduced: mixedUnintroduced });
  });

  it('reports zero for a course without units', () => {
    expect(courseTotals([])).toEqual({ entries: 0, unintroduced: 0 });
  });
});

describe('recommendedUnitAction', () => {
  it('recommends due practice before opening another learning path', () => {
    expect(
      recommendedUnitAction({
        ...unit(mixedEntries, mixedEntries, mixedUnintroduced),
        directions: [
          progress('to_target', { introduced: mixedEntries, due: 2 }),
          progress('to_native', { unintroduced: mixedUnintroduced }),
        ],
      }),
    ).toEqual({ kind: 'practice', direction: 'to_target' });
  });

  it('does not invent an order when both paths have due reviews', () => {
    expect(
      recommendedUnitAction({
        ...unit(mixedEntries, mixedEntries, 0),
        directions: [
          progress('to_target', { introduced: mixedEntries, due: 2 }),
          progress('to_native', { introduced: mixedEntries, due: 1 }),
        ],
      }),
    ).toBeNull();
  });

  it('does not invent an order when both paths have first reviews', () => {
    expect(
      recommendedUnitAction({
        ...unit(mixedEntries, mixedEntries, 0),
        directions: [
          progress('to_target', {
            introduced: mixedEntries,
            firstReviews: 2,
          }),
          progress('to_native', {
            introduced: mixedEntries,
            firstReviews: 1,
          }),
        ],
      }),
    ).toBeNull();
  });

  it('recommends the direction that still needs learning', () => {
    expect(
      recommendedUnitAction({
        ...unit(mixedEntries, mixedEntries, mixedUnintroduced),
        directions: [
          progress('to_target', { introduced: mixedEntries }),
          progress('to_native', { unintroduced: mixedUnintroduced }),
        ],
      }),
    ).toEqual({ kind: 'learn', direction: 'to_native' });
  });

  it('does not invent an order for two untouched learning paths', () => {
    expect(
      recommendedUnitAction({
        ...unit(mixedEntries, 0, mixedEntries),
        directions: [
          progress('to_target', { unintroduced: mixedEntries }),
          progress('to_native', { unintroduced: mixedEntries }),
        ],
      }),
    ).toBeNull();
  });

  it('recommends continuing the only started path', () => {
    expect(
      recommendedUnitAction({
        ...unit(mixedEntries, introducedEntries, mixedUnintroduced),
        directions: [
          progress('to_target', {
            introduced: introducedEntries,
            unintroduced: mixedUnintroduced,
          }),
          progress('to_native', { unintroduced: mixedEntries }),
        ],
      }),
    ).toEqual({ kind: 'learn', direction: 'to_target' });
  });

  it('recommends nothing while every learned path is resting', () => {
    expect(
      recommendedUnitAction({
        ...unit(mixedEntries, mixedEntries, 0),
        directions: [
          progress('to_target', { introduced: mixedEntries }),
          progress('to_native', { introduced: mixedEntries }),
        ],
      }),
    ).toBeNull();
  });
});
