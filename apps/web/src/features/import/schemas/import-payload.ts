import {
  Grammar,
  maximumEntriesPerPage,
  maximumUnitNameLength,
} from '@wordhold/ai/extraction/schema';
import { Schema } from 'effect';
import { Uuid } from '../../../shared/validate/uuid';
import { BookName } from '../../../shared/vocabulary/book-name';
import { EntryText, NewExample } from '../../../shared/vocabulary/entry-fields';
import { ImportPayloadValidationError } from '../errors/import-payload-validation-error';

// A page comes from one textbook of the course. The extraction rarely sees the
// book's title on a vocabulary page, so the learner picks the book or names a
// new one on the verify screen.
export const BookSelection = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('existing'),
    bookId: Uuid,
  }),
  Schema.Struct({
    kind: Schema.Literal('new'),
    name: BookName,
  }),
]);
export type BookSelectionData = typeof BookSelection.Type;

// Vocabulary entries are filed directly into the page's book, or into one of
// its chapters: either one that already exists or one being started with this
// page. The tag keeps these apart at the boundary, so the server never has to
// guess whether a name means "find this" or "create this".
export const UnitSelection = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('none'),
  }),
  Schema.Struct({
    kind: Schema.Literal('existing'),
    unitId: Uuid,
  }),
  Schema.Struct({
    kind: Schema.Literal('new'),
    name: Schema.Trim.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(maximumUnitNameLength),
    ),
  }),
]);
export type UnitSelectionData = typeof UnitSelection.Type;

// The human-verified shape of one entry, as submitted from the verify screen.
// Confidence is dropped: after verification the human is the authority.
export const VerifiedEntry = Schema.Struct({
  unit: UnitSelection,
  targetText: EntryText,
  nativeText: EntryText,
  grammar: Schema.optional(Grammar),
  example: Schema.optional(NewExample),
  // Present only when the learner confirmed importing a word that already
  // exists in the course with a different casing or example sentence. The
  // server refuses such an entry without this consent, so a stale verify
  // screen cannot slip a duplicate through.
  duplicateException: Schema.optional(Schema.Literal(true)),
  // Present only when the verify screen is completing an exact duplicate
  // without creating another entry. The server rechecks the duplicate before
  // it claims the page.
  skipDuplicate: Schema.optional(Schema.Literal(true)),
});
export type VerifiedEntryData = typeof VerifiedEntry.Type;

export const ImportPayload = Schema.Struct({
  pageId: Uuid,
  book: BookSelection,
  // Every existing unit named here must belong to the selected book.
  entries: Schema.Array(VerifiedEntry).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(maximumEntriesPerPage),
  ),
});
export type ImportPayloadData = typeof ImportPayload.Type;

const decode = Schema.decodeUnknownSync(ImportPayload);

export const decodeImportPayload = (input: unknown): ImportPayloadData => {
  try {
    return decode(input);
  } catch (cause) {
    // biome-ignore lint/style/useErrorCause: Schema.TaggedError carries cause as a typed field
    throw new ImportPayloadValidationError({
      cause,
      message: 'Die geprüften Einträge sind ungültig.',
    });
  }
};
