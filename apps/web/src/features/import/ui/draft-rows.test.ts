import { describe, expect, it } from 'bun:test';
import type { UnitSelectionData } from '../schemas/import-payload';
import {
  appendedRow,
  filedRows,
  type IdentifiedDraftRow,
  rowsWithoutUnitChange,
  rowsWithPageUnit,
  rowsWithUnitFrom,
  rowWithEntry,
  rowWithGeneratedExample,
  rowWithTranslatedExample,
  unitSections,
  withoutRow,
  withRestoredRow,
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
  unitFrom?: UnitSelectionData,
): IdentifiedDraftRow => ({
  rowId,
  targetText: 'word',
  nativeText: 'Wort',
  example: '',
  exampleNativeText: '',
  duplicateConfirmed: true,
  ...(unitFrom === undefined ? {} : { unitFrom }),
});

const sectionsOf = (rows: ReadonlyArray<IdentifiedDraftRow>) =>
  unitSections(rows).map(({ start, end, unit }) => ({ start, end, unit }));

describe('unit sections', () => {
  it('files each row into the unit named by the nearest row above it', () => {
    const rows = [
      confirmedRow('first', firstUnit),
      confirmedRow('second'),
      confirmedRow('third', secondUnit),
      confirmedRow('fourth'),
    ];

    expect(sectionsOf(rows)).toEqual([
      { start: 0, end: 2, unit: firstUnit },
      { start: 2, end: 4, unit: secondUnit },
    ]);
    expect(filedRows(rows).map((row) => row.unit)).toEqual([
      firstUnit,
      firstUnit,
      secondUnit,
      secondUnit,
    ]);
  });

  it('starts a new unit inside a section and joins it back', () => {
    const rows = [
      confirmedRow('first', firstUnit),
      confirmedRow('second'),
      confirmedRow('third'),
    ];

    const split = rowsWithUnitFrom(rows, 1, secondUnit);
    expect(sectionsOf(split)).toEqual([
      { start: 0, end: 1, unit: firstUnit },
      { start: 1, end: 3, unit: secondUnit },
    ]);

    const joined = rowsWithoutUnitChange(split, 1);
    expect(sectionsOf(joined)).toEqual([{ start: 0, end: 3, unit: firstUnit }]);
    expect(rowsWithoutUnitChange(joined, 0)).toBe(joined);
  });

  it('clears duplicate confirmation for every row whose unit changes', () => {
    const rows = [
      confirmedRow('first', firstUnit),
      confirmedRow('second'),
      confirmedRow('third'),
      confirmedRow('fourth', secondUnit),
    ];
    const confirmations = (changed: ReadonlyArray<IdentifiedDraftRow>) =>
      changed.map((row) => row.duplicateConfirmed);

    expect(confirmations(rowsWithUnitFrom(rows, 1, secondUnit))).toEqual([
      true,
      false,
      false,
      true,
    ]);
    expect(confirmations(rowsWithoutUnitChange(rows, 3))).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(confirmations(rowsWithPageUnit(rows, secondUnit))).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('files the whole page into one unit when the book changes', () => {
    const rows = [
      confirmedRow('first', firstUnit),
      confirmedRow('second', secondUnit),
    ];

    expect(sectionsOf(rowsWithPageUnit(rows, secondUnit))).toEqual([
      { start: 0, end: 2, unit: secondUnit },
    ]);
  });

  it('adds a row to the last section, or to the page unit on an empty page', () => {
    const rows = [
      confirmedRow('first', firstUnit),
      confirmedRow('second', secondUnit),
    ];

    expect(sectionsOf(appendedRow(rows, firstUnit))).toEqual([
      { start: 0, end: 1, unit: firstUnit },
      { start: 1, end: 3, unit: secondUnit },
    ]);
    expect(sectionsOf(appendedRow([], firstUnit))).toEqual([
      { start: 0, end: 1, unit: firstUnit },
    ]);
  });
});

describe('row removal', () => {
  it('passes a section start on to the next row and takes it back on undo', () => {
    const rows = [
      confirmedRow('first', firstUnit),
      confirmedRow('second'),
      confirmedRow('third', secondUnit),
    ];

    const { rows: remaining, removal } = withoutRow(rows, 0);
    expect(remaining.map((row) => row.rowId)).toEqual(['second', 'third']);
    expect(sectionsOf(remaining)).toEqual([
      { start: 0, end: 1, unit: firstUnit },
      { start: 1, end: 2, unit: secondUnit },
    ]);
    if (removal === null) {
      throw new Error('Expected a removal');
    }

    expect(withRestoredRow(remaining, removal)).toEqual(rows);
  });

  it('keeps a unit picked after the removal when the row comes back', () => {
    const rows = [confirmedRow('first', firstUnit), confirmedRow('second')];
    const { rows: remaining, removal } = withoutRow(rows, 0);
    if (removal === null) {
      throw new Error('Expected a removal');
    }
    const repicked = rowsWithUnitFrom(remaining, 0, secondUnit);

    const restored = withRestoredRow(repicked, removal);
    expect(restored.map((row) => row.rowId)).toEqual(['first', 'second']);
    expect(restored.map((row) => row.duplicateConfirmed)).toEqual([
      false,
      false,
    ]);
    expect(sectionsOf(restored)).toEqual([
      { start: 0, end: 2, unit: secondUnit },
    ]);
  });

  it('drops a section whose only row is removed and restores it on undo', () => {
    const rows = [
      confirmedRow('first', firstUnit),
      confirmedRow('second', secondUnit),
      confirmedRow('third', firstUnit),
    ];

    const { rows: remaining, removal } = withoutRow(rows, 1);
    expect(sectionsOf(remaining)).toEqual([
      { start: 0, end: 1, unit: firstUnit },
      { start: 1, end: 2, unit: firstUnit },
    ]);
    if (removal === null) {
      throw new Error('Expected a removal');
    }

    expect(withRestoredRow(remaining, removal)).toEqual(rows);
  });
});

describe('pending example results', () => {
  it('discards generated examples when their row was edited or removed while pending', async () => {
    const requested = confirmedRow('requested', firstUnit);
    const following = {
      ...confirmedRow('following'),
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
    ({ rows } = withoutRow(rows, 0));
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
        unitFrom: firstUnit,
      },
    ]);
  });

  it.each([
    'preceding removed',
    'requested removed',
    'rewritten',
    'manual translation',
  ])(
    'applies pending translations only to the unchanged surviving row: %s',
    async (scenario) => {
      const requested = {
        ...confirmedRow('requested'),
        example: 'The word appears in a sentence.',
      };
      const original = [
        confirmedRow('preceding', firstUnit),
        requested,
        { ...confirmedRow('following', secondUnit), targetText: 'voyage' },
      ];
      let rows: ReadonlyArray<IdentifiedDraftRow> = original;
      let resolveTranslation: (native: string) => void = () => undefined;
      const translation = new Promise<string>((resolve) => {
        resolveTranslation = resolve;
      });
      const finishTranslation = async () => {
        const native = await translation;
        rows = rowWithTranslatedExample(
          rows,
          requested.rowId,
          requested.example,
          native,
        );
      };
      const pending = finishTranslation();
      if (scenario === 'preceding removed') {
        ({ rows } = withoutRow(rows, 0));
      } else if (scenario === 'requested removed') {
        ({ rows } = withoutRow(rows, 1));
      } else {
        rows = rowWithEntry(rows, 1, {
          ...requested,
          ...(scenario === 'rewritten'
            ? { example: 'A rewritten sentence.' }
            : { exampleNativeText: 'Manuelle Übersetzung.' }),
        });
      }
      const beforeCompletion = rows;
      resolveTranslation('Das Wort steht in einem Satz.');
      await pending;
      expect(rows).toEqual(
        scenario === 'preceding removed'
          ? [
              {
                ...requested,
                exampleNativeText: 'Das Wort steht in einem Satz.',
                unitFrom: firstUnit,
              },
              original[2],
            ]
          : beforeCompletion,
      );
    },
  );
});
