import {
  Grammar,
  maximumEntriesPerPage,
  maximumEntryTextLength,
  maximumExampleLength,
  maximumLabelLength,
} from '@wordhold/ai/extraction/schema';
import { Schema } from 'effect';
import { ImportPayloadValidationError } from '../errors/import-payload-validation-error';

// The human-verified shape of one entry, as submitted from the verify screen.
// Confidence is dropped: after verification the human is the authority.
export const VerifiedEntry = Schema.Struct({
  type: Schema.Literal('word', 'expression', 'sentence'),
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
});
export type VerifiedEntryData = typeof VerifiedEntry.Type;

export const ImportPayload = Schema.Struct({
  pageId: Schema.UUID,
  label: Schema.optional(
    Schema.Trim.pipe(Schema.maxLength(maximumLabelLength)),
  ),
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
