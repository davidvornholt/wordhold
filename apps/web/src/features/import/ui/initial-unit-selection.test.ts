import { describe, expect, it } from 'bun:test';
import type { Unit } from '../services/repository';
import { initialUnitSelection } from './initial-unit-selection';

const bookId = '66666666-6666-4666-8666-666666666666';

const units: ReadonlyArray<Unit> = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    bookId,
    name: 'Unité 2',
    position: 0,
    isHolding: false,
    entryCount: 18,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    bookId,
    name: 'Unité 3',
    position: 1,
    isHolding: false,
    entryCount: 12,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    bookId,
    name: 'Ohne Einheit',
    position: 2,
    isHolding: true,
    entryCount: 2,
  },
];

const chapterUnits: ReadonlyArray<Unit> = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    bookId,
    name: 'Chapter 1: The time of your life',
    position: 0,
    isHolding: false,
    entryCount: 14,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    bookId,
    name: 'Chapter 10: Global issues',
    position: 1,
    isHolding: false,
    entryCount: 9,
  },
];

describe('initialUnitSelection', () => {
  it('selects an existing unit whose normalized name matches the extraction', () => {
    expect(initialUnitSelection(units, '  UNITÉ   2  ', 'Découvertes')).toEqual(
      {
        kind: 'existing',
        unitId: units[0]?.id,
      },
    );
  });

  it('matches a running head that prints the book title before the unit', () => {
    expect(
      initialUnitSelection(
        chapterUnits,
        'Context Starter · Chapter 1: The Time of Your Life',
        'Context Starter',
      ),
    ).toEqual({ kind: 'existing', unitId: chapterUnits[0]?.id });
  });

  it('ignores punctuation between the words of a unit name', () => {
    expect(
      initialUnitSelection(
        chapterUnits,
        'Chapter 1 – The Time of Your Life',
        'Context Starter',
      ),
    ).toEqual({ kind: 'existing', unitId: chapterUnits[0]?.id });
  });

  it('matches a unit named shorter or longer than the heading', () => {
    expect(
      initialUnitSelection(chapterUnits, 'Chapter 1', 'Context Starter'),
    ).toEqual({ kind: 'existing', unitId: chapterUnits[0]?.id });
    expect(
      initialUnitSelection(units, 'Unité 2 · En vacances', 'Découvertes'),
    ).toEqual({ kind: 'existing', unitId: units[0]?.id });
  });

  it('keeps numbered units apart', () => {
    expect(
      initialUnitSelection(chapterUnits, 'Chapter 11', 'Context Starter'),
    ).toEqual({ kind: 'new', name: 'Chapter 11' });
  });

  it('does not match on a single shared word', () => {
    expect(
      initialUnitSelection(chapterUnits, 'Life', 'Context Starter'),
    ).toEqual({ kind: 'new', name: 'Life' });
  });

  it('prefills a new unit without the book title when the heading is unknown', () => {
    expect(
      initialUnitSelection(
        chapterUnits,
        'Context Starter · Chapter 2: Coming of Age',
        'Context Starter',
      ),
    ).toEqual({ kind: 'new', name: 'Chapter 2: Coming of Age' });
    expect(initialUnitSelection(units, 'Unité 4', 'Découvertes')).toEqual({
      kind: 'new',
      name: 'Unité 4',
    });
  });

  it('treats a heading that only names the book as no heading', () => {
    expect(
      initialUnitSelection(chapterUnits, 'CONTEXT STARTER', 'Context Starter'),
    ).toEqual({ kind: 'existing', unitId: chapterUnits[1]?.id });
  });

  it('falls back to the latest real unit without an extracted name', () => {
    expect(initialUnitSelection(units, undefined, 'Découvertes')).toEqual({
      kind: 'existing',
      unitId: units[1]?.id,
    });
  });

  it('files words directly into the book when no real unit or extraction exists', () => {
    expect(initialUnitSelection(units.slice(2), undefined, '')).toEqual({
      kind: 'none',
    });
  });
});
