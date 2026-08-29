import { describe, expect, it } from 'bun:test';
import type { Unit } from '../services/repository';
import { initialUnitSelection } from './initial-unit-selection';

const units: ReadonlyArray<Unit> = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Unité 2',
    position: 0,
    isHolding: false,
    entryCount: 18,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Unité 3',
    position: 1,
    isHolding: false,
    entryCount: 12,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Ohne Einheit',
    position: 2,
    isHolding: true,
    entryCount: 2,
  },
];

describe('initialUnitSelection', () => {
  it('selects an existing unit whose normalized name matches the extraction', () => {
    expect(initialUnitSelection(units, '  UNITÉ   2  ')).toEqual({
      kind: 'existing',
      unitId: units[0]?.id,
    });
  });

  it('prefills a new unit when the extracted name is unknown', () => {
    expect(initialUnitSelection(units, 'Unité 4')).toEqual({
      kind: 'new',
      name: 'Unité 4',
    });
  });

  it('falls back to the latest real unit without an extracted name', () => {
    expect(initialUnitSelection(units, undefined)).toEqual({
      kind: 'existing',
      unitId: units[1]?.id,
    });
  });

  it('requires a new unit name when no real unit or extraction exists', () => {
    expect(initialUnitSelection(units.slice(2), undefined)).toEqual({
      kind: 'new',
      name: '',
    });
  });
});
