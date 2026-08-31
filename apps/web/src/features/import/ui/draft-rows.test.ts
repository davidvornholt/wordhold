import { describe, expect, it } from 'bun:test';
import type { UnitSelectionData } from '../schemas/import-payload';
import { rowsWithUnit, rowsWithUnitFrom, rowWithUnit } from './draft-rows';
import type { DraftRow } from './verify-form-selection';

const firstUnit = {
  kind: 'existing',
  unitId: '11111111-1111-4111-8111-111111111111',
} as const satisfies UnitSelectionData;
const secondUnit = {
  kind: 'existing',
  unitId: '22222222-2222-4222-8222-222222222222',
} as const satisfies UnitSelectionData;

const confirmedRow = (unit: UnitSelectionData): DraftRow => ({
  targetText: 'word',
  nativeText: 'Wort',
  example: '',
  unit,
  duplicateConfirmed: true,
});

describe('draft row unit assignment', () => {
  it('clears duplicate confirmation for every row whose unit changes', () => {
    const rows = [
      confirmedRow(firstUnit),
      confirmedRow(firstUnit),
      confirmedRow(firstUnit),
    ];

    expect(
      rowWithUnit(rows, 1, secondUnit).map((row) => row.duplicateConfirmed),
    ).toEqual([true, false, true]);
    expect(
      rowsWithUnitFrom(rows, 1, secondUnit).map(
        (row) => row.duplicateConfirmed,
      ),
    ).toEqual([true, false, false]);
    expect(
      rowsWithUnit(rows, secondUnit).map((row) => row.duplicateConfirmed),
    ).toEqual([false, false, false]);
  });
});
