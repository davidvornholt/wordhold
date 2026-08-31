import type { UnitSelectionData } from '../schemas/import-payload';
import type { DuplicateVerdict } from '../services/entry-identity';
import type { DraftEntry } from './entry-row';

export type VerificationEntry = DraftEntry & {
  readonly unit: UnitSelectionData;
  readonly duplicateException?: true;
  readonly skipDuplicate?: true;
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
  readonly submissionEntries: ReadonlyArray<VerificationEntry>;
  readonly skippedDuplicates: ReadonlyArray<VerificationEntry>;
  readonly skipped: number;
};

export const entriesForSubmission = (
  selection: ImportSelection,
): ReadonlyArray<VerificationEntry> => selection.submissionEntries;

export const canCompleteWithoutImport = (
  drafts: ReadonlyArray<DraftRow>,
  selection: ImportSelection,
): boolean =>
  selection.entries.length === 0 &&
  selection.skipped === selection.skippedDuplicates.length &&
  selection.skippedDuplicates.length > 0 &&
  drafts.every(entryIsComplete);

// A complete row is imported when it is no duplicate, or when it is a
// confirmed exception (same word, different casing or example). Everything
// else stays behind and is reported as skipped.
export const selectImportableEntries = (
  drafts: ReadonlyArray<DraftRow>,
  verdicts: ReadonlyArray<DuplicateVerdict>,
): ImportSelection => {
  const completeCount = drafts.filter(entryIsComplete).length;
  const submissionEntries = drafts.flatMap((entry, index) => {
    if (!entryIsComplete(entry)) {
      return [];
    }
    const verdict = verdicts[index];
    if (verdict === 'exact') {
      return [
        {
          ...verificationEntry(entry),
          skipDuplicate: true as const,
        },
      ];
    }
    if (
      verdict === 'none' ||
      (verdict === 'exception' && entry.duplicateConfirmed)
    ) {
      return [verificationEntry(entry)];
    }
    return [];
  });
  const importable = submissionEntries.filter(
    (entry) => entry.skipDuplicate !== true,
  );
  const skippedDuplicates = submissionEntries.filter(
    (entry) => entry.skipDuplicate === true,
  );
  return {
    entries: importable,
    submissionEntries,
    skippedDuplicates,
    skipped: completeCount - importable.length,
  };
};
