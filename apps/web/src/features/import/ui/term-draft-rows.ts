import { findDuplicate } from '../../../shared/vocabulary/entry-identity';

// One term read from a subject's notes, as the learner corrects it.
export type TermDraft = {
  readonly term: string;
  readonly definition: string;
  readonly confidence?: number;
};

export type TermRow = TermDraft & { readonly rowId: string };

// What "Rückgängig" needs to put a removed row back where it was.
export type TermRemoval = {
  readonly row: TermRow;
  readonly index: number;
};

// A subject keeps a term once. The same term in other casing is a different
// term ("NO" is not "No") and is saved as well; the learner is only told.
export type TermRepeat =
  | { readonly verdict: 'none' }
  | {
      readonly verdict: 'exact' | 'exception';
      // The term as already written, in the subject or higher on the page.
      readonly term: string;
      readonly onPage: boolean;
    };

export type TermReview = {
  readonly repeats: ReadonlyArray<TermRepeat>;
  readonly terms: ReadonlyArray<{
    readonly term: string;
    readonly definition: string;
  }>;
  // Exact repeats, left out of the save.
  readonly skipped: number;
  // Rows with a term but no definition, or the other way round.
  readonly incomplete: ReadonlyArray<number>;
};

const addedRowPrefix = 'added-';

export const termRows = (
  drafts: ReadonlyArray<TermDraft>,
): ReadonlyArray<TermRow> =>
  drafts.map((draft, index) => ({ ...draft, rowId: `read-${index}` }));

export const withAddedTermRow = (
  rows: ReadonlyArray<TermRow>,
): ReadonlyArray<TermRow> => [
  ...rows,
  {
    term: '',
    definition: '',
    rowId: `${addedRowPrefix}${globalThis.crypto.randomUUID()}`,
  },
];

// Added on this screen rather than read from the photo.
export const termRowWasAdded = (row: TermRow): boolean =>
  row.rowId.startsWith(addedRowPrefix);

// An edited row keeps its reading's confidence: the flag stays until the
// row is compared with the photo, not until it is touched.
export const withTermEdit = (
  rows: ReadonlyArray<TermRow>,
  index: number,
  change: Partial<Pick<TermDraft, 'term' | 'definition'>>,
): ReadonlyArray<TermRow> =>
  rows.map((row, rowIndex) =>
    rowIndex === index ? { ...row, ...change } : row,
  );

export const withoutTermRow = (
  rows: ReadonlyArray<TermRow>,
  index: number,
): {
  readonly rows: ReadonlyArray<TermRow>;
  readonly removal: TermRemoval | null;
} => {
  const row = rows[index];
  return row === undefined
    ? { rows, removal: null }
    : {
        rows: rows.filter((_row, rowIndex) => rowIndex !== index),
        removal: { row, index },
      };
};

export const withRestoredTermRow = (
  rows: ReadonlyArray<TermRow>,
  removal: TermRemoval,
): ReadonlyArray<TermRow> => [
  ...rows.slice(0, removal.index),
  removal.row,
  ...rows.slice(removal.index),
];

const isBlank = (text: string): boolean => text.trim() === '';

const asEntries = (terms: ReadonlyArray<string>) =>
  terms.map((targetText) => ({ targetText, examples: [] }));

const repeatOf = (term: string, terms: ReadonlyArray<string>) =>
  findDuplicate({ targetText: term, example: '' }, asEntries(terms));

// An exact repeat outranks a casing variant, and the subject outranks the
// page, so the note names what makes the row a repeat.
const termRepeat = (
  term: string,
  existingTerms: ReadonlyArray<string>,
  earlierTerms: ReadonlyArray<string>,
): TermRepeat => {
  const stored = repeatOf(term, existingTerms);
  const earlier = repeatOf(term, earlierTerms);
  if (stored.verdict === 'exact') {
    return { verdict: 'exact', term: stored.entry.targetText, onPage: false };
  }
  if (earlier.verdict === 'exact') {
    return { verdict: 'exact', term: earlier.entry.targetText, onPage: true };
  }
  if (stored.verdict === 'exception') {
    return {
      verdict: 'exception',
      term: stored.entry.targetText,
      onPage: false,
    };
  }
  return earlier.verdict === 'exception'
    ? { verdict: 'exception', term: earlier.entry.targetText, onPage: true }
    : { verdict: 'none' };
};

export const termRepeats = (
  rows: ReadonlyArray<TermRow>,
  existingTerms: ReadonlyArray<string>,
): ReadonlyArray<TermRepeat> =>
  rows.map((row, index) =>
    termRepeat(
      row.term,
      existingTerms,
      rows
        .slice(0, index)
        .map((earlier) => earlier.term)
        .filter((term) => !isBlank(term)),
    ),
  );

// What saving the page would do. Empty rows are ignored, exact repeats are
// skipped, and a half-filled row holds the save until it is completed or
// removed.
export const termReview = (
  rows: ReadonlyArray<TermRow>,
  existingTerms: ReadonlyArray<string>,
): TermReview => {
  const repeats = termRepeats(rows, existingTerms);
  const terms: Array<{ readonly term: string; readonly definition: string }> =
    [];
  const incomplete: Array<number> = [];
  let skipped = 0;
  for (const [index, row] of rows.entries()) {
    const term = row.term.trim();
    const definition = row.definition.trim();
    const blank = term === '' && definition === '';
    if (!blank && repeats[index]?.verdict === 'exact') {
      skipped += 1;
    } else if (!blank && (term === '' || definition === '')) {
      incomplete.push(index);
    } else if (!blank) {
      terms.push({ term, definition });
    }
  }
  return { repeats, terms, skipped, incomplete };
};
