import { Grammar } from '@wordhold/ai/extraction/schema';
import { Schema } from 'effect';

// The human-verified shape of one entry, as submitted from the verify screen.
// Confidence is dropped: after verification the human is the authority.
export const VerifiedEntry = Schema.Struct({
  type: Schema.Literal('word', 'expression', 'sentence'),
  targetText: Schema.Trim.pipe(Schema.minLength(1)),
  nativeText: Schema.Trim.pipe(Schema.minLength(1)),
  grammar: Schema.optional(Grammar),
  example: Schema.optional(Schema.String),
});
export type VerifiedEntryData = typeof VerifiedEntry.Type;

export const ImportPayload = Schema.Struct({
  pageId: Schema.UUID,
  label: Schema.optional(Schema.String),
  entries: Schema.Array(VerifiedEntry).pipe(Schema.minItems(1)),
});
export type ImportPayloadData = typeof ImportPayload.Type;
