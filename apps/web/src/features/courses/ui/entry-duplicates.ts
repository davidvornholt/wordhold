import { wordLocation } from '../../../shared/vocabulary/book-name';
import { findDuplicate } from '../../../shared/vocabulary/entry-identity';
import type { VocabularyEntry } from '../schemas/course-units';
import { quoted } from './use-new-vocabulary-entry';

// What the learner is told about a draft that repeats a stored entry. Only
// an exact repeat blocks saving; a variant is pointed out and left to the
// learner, who typed it on purpose.
export type DraftDuplicate = {
  readonly blocked: boolean;
  readonly hint: string | null;
};

const noDuplicate: DraftDuplicate = { blocked: false, hint: null };

// A corrected entry is never a repeat of itself.
const otherEntries = (
  entries: ReadonlyArray<VocabularyEntry>,
  correctedEntryId: string | null,
) => entries.filter((entry) => entry.id !== correctedEntryId);

export const wordDuplicate = (
  entries: ReadonlyArray<VocabularyEntry>,
  draft: { readonly targetText: string; readonly example: string },
  correctedEntryId: string | null,
): DraftDuplicate => {
  const targetText = draft.targetText.trim();
  const duplicate = findDuplicate(
    { targetText, example: draft.example },
    otherEntries(entries, correctedEntryId).map((entry) => ({
      targetText: entry.targetText,
      examples: entry.example === null ? [] : [entry.example.targetText],
      location: wordLocation(entry.bookName, entry.unitName),
    })),
  );
  switch (duplicate.verdict) {
    case 'exact':
      return {
        blocked: true,
        hint: `${quoted(targetText)} ist schon in ${duplicate.entry.location}.`,
      };
    case 'exception':
      return {
        blocked: false,
        hint: `${quoted(targetText)} ist schon in ${duplicate.entry.location}, mit anderer Schreibweise oder anderem Beispielsatz.`,
      };
    default:
      return noDuplicate;
  }
};

// A subject's term or a collection's title, which has no example sentence.
export const listEntryDuplicate = (
  entries: ReadonlyArray<VocabularyEntry>,
  draftTerm: string,
  correctedEntryId: string | null,
): DraftDuplicate => {
  const term = draftTerm.trim();
  const duplicate = findDuplicate(
    { targetText: term, example: '' },
    otherEntries(entries, correctedEntryId).map((entry) => ({
      targetText: entry.targetText,
      examples: [],
    })),
  );
  switch (duplicate.verdict) {
    case 'exact':
      return { blocked: true, hint: `${quoted(term)} ist schon eingetragen.` };
    case 'exception':
      return {
        blocked: false,
        hint: `${quoted(term)} ist schon als ${quoted(duplicate.entry.targetText)} eingetragen.`,
      };
    default:
      return noDuplicate;
  }
};
