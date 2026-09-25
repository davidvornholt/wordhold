import {
  type DuplicateVerdict,
  type ExistingEntry,
  findDuplicate,
} from '../../../shared/vocabulary/entry-identity';
import type { UnitEntry } from '../services/repository';

export type AssessableDraft = {
  readonly targetText: string;
  readonly nativeText: string;
  readonly example: string;
};

// Where the repeated word already is: a stored entry's "book · unit", or null
// when it is an earlier row of this same page.
export type DraftDuplicate =
  | { readonly verdict: 'none' }
  | {
      readonly verdict: Exclude<DuplicateVerdict, 'none'>;
      readonly location: string | null;
    };

type PooledEntry = ExistingEntry & { readonly location: string | null };

const draftIsImported = (draft: AssessableDraft): boolean =>
  draft.targetText.trim() !== '' && draft.nativeText.trim() !== '';

// Duplicates are checked across the whole course, whichever book or unit a
// row is filed into, matching the server-side check. Earlier importable rows
// join the pool, so a page listing one word twice flags the second occurrence.
export const assessDraftDuplicates = (
  drafts: ReadonlyArray<AssessableDraft>,
  storedEntries: ReadonlyArray<UnitEntry>,
): ReadonlyArray<DraftDuplicate> => {
  const pool: Array<PooledEntry> = storedEntries.map((entry) => ({
    targetText: entry.targetText,
    examples: entry.examples,
    location: entry.location,
  }));
  return drafts.map((draft) => {
    const duplicate = findDuplicate(
      { targetText: draft.targetText, example: draft.example },
      pool,
    );
    if (draftIsImported(draft)) {
      pool.push({
        targetText: draft.targetText,
        examples: draft.example.trim() === '' ? [] : [draft.example],
        location: null,
      });
    }
    return duplicate.verdict === 'none'
      ? duplicate
      : { verdict: duplicate.verdict, location: duplicate.entry.location };
  });
};
