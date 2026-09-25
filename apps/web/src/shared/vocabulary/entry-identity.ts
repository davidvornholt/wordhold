// Duplicate detection compares entries by what a learner would recognise as
// the same word: punctuation, symbols, and extra whitespace never make two
// spellings different. Case is kept out of the identity key but preserved in
// the comparable text, because a casing difference ("Sie" next to "sie") is a
// deliberate distinction that justifies importing the word again.
const strippable = /[^\p{L}\p{N}\s]+/gu;
const whitespace = /\s+/gu;

export const comparableEntryText = (text: string): string =>
  text
    .normalize('NFKC')
    .replace(strippable, ' ')
    .replace(whitespace, ' ')
    .trim();

const canonicalEntryText = (text: string): string =>
  comparableEntryText(text).replace(whitespace, '');

export const entryIdentityKey = (text: string): string =>
  canonicalEntryText(text).toLocaleLowerCase();

export type ExistingEntry = {
  readonly targetText: string;
  readonly examples: ReadonlyArray<string>;
};

// 'exact' — same word, same casing, same example sentence: never imported again.
// 'exception' — same word, but casing or example sentence differs: importable
// only with explicit confirmation.
export type DuplicateVerdict = 'none' | 'exception' | 'exact';

// The stored entry a draft repeats, so the learner can be told where the word
// already is. An exact match wins over a variant.
export type DuplicateMatch<Entry extends ExistingEntry> =
  | { readonly verdict: 'none' }
  | { readonly verdict: 'exception' | 'exact'; readonly entry: Entry };

const noDuplicate = { verdict: 'none' } as const;

const exampleKeys = (examples: ReadonlyArray<string>): ReadonlyArray<string> =>
  examples.length === 0 ? [''] : examples.map(entryIdentityKey);

export const findDuplicate = <Entry extends ExistingEntry>(
  draft: { readonly targetText: string; readonly example: string },
  existing: ReadonlyArray<Entry>,
): DuplicateMatch<Entry> => {
  const identity = entryIdentityKey(draft.targetText);
  if (identity === '') {
    return noDuplicate;
  }
  const sameWord = existing.filter(
    (entry) => entryIdentityKey(entry.targetText) === identity,
  );
  const [firstVariant] = sameWord;
  if (firstVariant === undefined) {
    return noDuplicate;
  }
  const draftCasing = canonicalEntryText(draft.targetText);
  const draftExample = entryIdentityKey(draft.example);
  const exact = sameWord.find(
    (entry) =>
      canonicalEntryText(entry.targetText) === draftCasing &&
      exampleKeys(entry.examples).includes(draftExample),
  );
  return exact === undefined
    ? { verdict: 'exception', entry: firstVariant }
    : { verdict: 'exact', entry: exact };
};
