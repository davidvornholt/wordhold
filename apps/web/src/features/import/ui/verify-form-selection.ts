import type { UnitSelectionData } from '../schemas/import-payload';
import type { DuplicateVerdict } from '../services/entry-identity';
import type { DraftEntry } from './entry-row';

export type VerificationEntry = DraftEntry & {
  readonly unit: UnitSelectionData;
  readonly duplicateException?: true;
};

export type DraftRow = DraftEntry & {
  readonly unit: UnitSelectionData;
  readonly duplicateConfirmed: boolean;
};

export const entryIsComplete = (entry: DraftEntry): boolean =>
  entry.targetText.trim() !== '' && entry.nativeText.trim() !== '';

export const unitSelectionIsComplete = (
  selection: UnitSelectionData,
): boolean => selection.kind === 'existing' || selection.name.trim() !== '';

export const skippedSummary = (count: number): string =>
  count === 1
    ? '1 Duplikat wird nicht importiert.'
    : `${count} Duplikate werden nicht importiert.`;

const verificationEntry = ({
  duplicateConfirmed,
  ...entry
}: DraftRow): VerificationEntry =>
  duplicateConfirmed ? { ...entry, duplicateException: true } : entry;

export type ImportSelection = {
  readonly entries: ReadonlyArray<VerificationEntry>;
  readonly skipped: number;
};

// A complete row is imported when it is no duplicate, or when it is a
// confirmed exception (same word, different casing or example). Everything
// else stays behind and is reported as skipped.
export const selectImportableEntries = (
  drafts: ReadonlyArray<DraftRow>,
  verdicts: ReadonlyArray<DuplicateVerdict>,
): ImportSelection => {
  const completeCount = drafts.filter(entryIsComplete).length;
  const importable = drafts.filter(
    (entry, index) =>
      entryIsComplete(entry) &&
      (verdicts[index] === 'none' ||
        (verdicts[index] === 'exception' && entry.duplicateConfirmed)),
  );
  return {
    entries: importable.map(verificationEntry),
    skipped: completeCount - importable.length,
  };
};
