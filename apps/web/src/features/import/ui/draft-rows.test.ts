import { describe, expect, it } from 'bun:test';
import type { UnitSelectionData } from '../schemas/import-payload';
import {
  type IdentifiedDraftRow,
  rowsWithUnit,
  rowsWithUnitFrom,
  rowWithEntry,
  rowWithGeneratedExample,
  rowWithUnit,
  withoutRow,
} from './draft-rows';

const firstUnit = {
  kind: 'existing',
  unitId: '11111111-1111-4111-8111-111111111111',
} as const satisfies UnitSelectionData;
const secondUnit = {
  kind: 'existing',
  unitId: '22222222-2222-4222-8222-222222222222',
} as const satisfies UnitSelectionData;

const confirmedRow = (
  rowId: string,
  unit: UnitSelectionData,
): IdentifiedDraftRow => ({
  rowId,
  targetText: 'word',
  nativeText: 'Wort',
  example: '',
  unit,
  duplicateConfirmed: true,
});

describe('draft rows', () => {
  it('clears duplicate confirmation for every row whose unit changes', () => {
    const rows = [
      confirmedRow('first', firstUnit),
      confirmedRow('second', firstUnit),
      confirmedRow('third', firstUnit),
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

  it('discards generated examples when their row was edited or removed while pending', async () => {
    const requested = confirmedRow('requested', firstUnit);
    const following = {
      ...confirmedRow('following', firstUnit),
      nativeText: 'Reise',
      targetText: 'voyage',
    };
    let rows: ReadonlyArray<IdentifiedDraftRow> = [requested, following];
    let resolveGeneration: (generated: {
      readonly target: string;
      readonly native: string;
    }) => void = () => undefined;
    const generation = new Promise<{
      readonly target: string;
      readonly native: string;
    }>((resolve) => {
      resolveGeneration = resolve;
    });
    const finishGeneration = async (row: IdentifiedDraftRow) => {
      const generated = await generation;
      rows = rowWithGeneratedExample(
        rows,
        row.rowId,
        {
          targetText: row.targetText.trim(),
          nativeText: row.nativeText.trim(),
          example: row.example,
        },
        generated,
      );
    };
    const pendingRequest = finishGeneration(requested);

    rows = rowWithEntry(rows, 1, {
      ...following,
      targetText: 'voyages',
    });
    rows = withoutRow(rows, 0);
    resolveGeneration({
      target: 'The word appears in a sentence.',
      native: 'Das Wort steht in einem Satz.',
    });
    await pendingRequest;

    expect(rows).toEqual([
      {
        ...following,
        targetText: 'voyages',
        duplicateConfirmed: false,
      },
    ]);
  });
});
