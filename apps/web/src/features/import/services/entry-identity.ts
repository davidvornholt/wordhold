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

const exampleKeys = (examples: ReadonlyArray<string>): ReadonlyArray<string> =>
  examples.length === 0 ? [''] : examples.map(entryIdentityKey);

export const duplicateVerdict = (
  draft: { readonly targetText: string; readonly example: string },
  existing: ReadonlyArray<ExistingEntry>,
): DuplicateVerdict => {
  const identity = entryIdentityKey(draft.targetText);
  if (identity === '') {
    return 'none';
  }
  const sameWord = existing.filter(
    (entry) => entryIdentityKey(entry.targetText) === identity,
  );
  if (sameWord.length === 0) {
    return 'none';
  }
  const draftCasing = canonicalEntryText(draft.targetText);
  const draftExample = entryIdentityKey(draft.example);
  return sameWord.some(
    (entry) =>
      canonicalEntryText(entry.targetText) === draftCasing &&
      exampleKeys(entry.examples).includes(draftExample),
  )
    ? 'exact'
    : 'exception';
};
