import {
  Grammar,
  maximumEntriesPerPage,
  maximumEntryTextLength,
  maximumExampleLength,
  maximumUnitNameLength,
} from '@wordhold/ai/extraction/schema';
import { Schema } from 'effect';
import { ImportPayloadValidationError } from '../errors/import-payload-validation-error';

// Vocabulary entries are filed into a chapter of the textbook, either one that already
// exists or one being started with this page. The tag keeps the two apart at
// the boundary, so the server never has to guess whether a name means "find
// this" or "create this".
export const UnitSelection = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('existing'),
    unitId: Schema.UUID,
  }),
  Schema.Struct({
    kind: Schema.Literal('new'),
    name: Schema.Trim.pipe(
      Schema.minLength(1),
      Schema.maxLength(maximumUnitNameLength),
    ),
  }),
);
export type UnitSelectionData = typeof UnitSelection.Type;

// The human-verified shape of one entry, as submitted from the verify screen.
// Confidence is dropped: after verification the human is the authority.
export const VerifiedEntry = Schema.Struct({
  unit: UnitSelection,
  targetText: Schema.Trim.pipe(
    Schema.minLength(1),
    Schema.maxLength(maximumEntryTextLength),
  ),
  nativeText: Schema.Trim.pipe(
    Schema.minLength(1),
    Schema.maxLength(maximumEntryTextLength),
  ),
  grammar: Schema.optional(Grammar),
  example: Schema.optional(
    Schema.Trim.pipe(Schema.maxLength(maximumExampleLength)),
  ),
  // Present only when the learner confirmed importing a word that already
  // exists in the unit with a different casing or example sentence. The
  // server refuses such an entry without this consent, so a stale verify
  // screen cannot slip a duplicate through.
  duplicateException: Schema.optional(Schema.Literal(true)),
});
export type VerifiedEntryData = typeof VerifiedEntry.Type;

export const ImportPayload = Schema.Struct({
  pageId: Schema.UUID,
  entries: Schema.Array(VerifiedEntry).pipe(
    Schema.minItems(1),
    Schema.maxItems(maximumEntriesPerPage),
  ),
});
export type ImportPayloadData = typeof ImportPayload.Type;

const decode = Schema.decodeUnknownSync(ImportPayload);

export const decodeImportPayload = (input: unknown): ImportPayloadData => {
  try {
    return decode(input);
  } catch (cause) {
    // biome-ignore lint/style/useErrorCause: Data.TaggedError carries cause as a typed field
    throw new ImportPayloadValidationError({
      cause,
      message: 'Die geprüften Einträge sind ungültig.',
    });
  }
};
