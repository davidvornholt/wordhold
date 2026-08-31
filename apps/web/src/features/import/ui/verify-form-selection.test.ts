import { describe, expect, it } from 'bun:test';
import type { UnitSelectionData } from '../schemas/import-payload';
import type { DraftRow } from './verify-form-selection';
import {
  canCompleteWithoutImport,
  entriesForSubmission,
  selectImportableEntries,
} from './verify-form-selection';

const unit = {
  kind: 'existing',
  unitId: '11111111-1111-4111-8111-111111111111',
} as const satisfies UnitSelectionData;

const row = (targetText: string): DraftRow => ({
  targetText,
  nativeText: 'Wort',
  example: '',
  unit,
  duplicateConfirmed: false,
});

describe('verify form selection', () => {
  it('submits exact duplicates as ordered skip operations', () => {
    const drafts = [row('already stored'), row('new word')];
    const selection = selectImportableEntries(drafts, ['exact', 'none']);

    expect(selection.entries.map((entry) => entry.targetText)).toEqual([
      'new word',
    ]);
    expect(
      entriesForSubmission(selection).map((entry) => ({
        targetText: entry.targetText,
        skipDuplicate: entry.skipDuplicate,
      })),
    ).toEqual([
      { targetText: 'already stored', skipDuplicate: true },
      { targetText: 'new word', skipDuplicate: undefined },
    ]);

    const allDuplicates = selectImportableEntries(
      [row('already stored')],
      ['exact'],
    );
    expect(
      canCompleteWithoutImport([row('already stored')], allDuplicates),
    ).toBe(true);
  });
});
