import { Schema } from 'effect';

export const maximumBookNameLength = 80;

export const BookName = Schema.Trim.pipe(
  Schema.minLength(1),
  Schema.maxLength(maximumBookNameLength),
);

// Where a stored word lives, as the learner reads it: the book first, because
// two books of one course may each have a unit with the same name.
export const unitLocation = (bookName: string, unitName: string): string =>
  `${bookName} · ${unitName}`;
