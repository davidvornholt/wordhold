import { Schema } from 'effect';

export const maximumBookNameLength = 80;

export const BookName = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(maximumBookNameLength),
);

// Where a stored word lives, as the learner reads it: the book first, because
// two books of one course may each have a unit with the same name. A word
// without a unit lives directly in the book.
export const wordLocation = (
  bookName: string,
  unitName: string | null,
): string => (unitName === null ? bookName : `${bookName} · ${unitName}`);
